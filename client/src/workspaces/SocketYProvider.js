import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { emitWithAck } from "./socketCall";

// An empty Yjs update (no structs, no deletes) encodes as [0, 0].
const EMPTY_UPDATE_LENGTH = 2;

// The server's Socket.IO maxHttpBufferSize is 5e6: a bigger frame makes it
// drop the connection, and the reconnect diff would resend it forever.
export const MAX_UPDATE_BYTES = 4.5e6;

// Retry delays after a transient failure: 0.5s, 1s, 2s, ... capped at 30s.
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 30000;

// The server refused the content itself: resending it can never succeed,
// and later edits build on it, so the doc can't sync any more.
const PERMANENT_ERRORS = new Set(["invalid", "too_large"]);
// Not something a retry fixes; the editor closes or asks to log in.
const FATAL_ERRORS = new Set(["forbidden", "not_found", "unauthenticated"]);

/** Socket.IO hands binary over as ArrayBuffer (browser) or Buffer (node). */
function toUint8(data) {
  if (data instanceof Uint8Array) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("invalid binary payload");
}

/**
 * Syncs a Y.Doc with the server over the app's Socket.IO connection, using
 * the doc:open|update|close|awareness events.
 *
 * On (re)connect it opens the doc, applies the server state, then sends the
 * local edits the server lacks (diff against the server's state vector), so
 * edits made while offline merge exactly once. While not synced, local
 * updates are not emitted: that diff covers them.
 */
export class SocketYProvider {
  constructor(socket, docId, ydoc) {
    this.socket = socket;
    this.docId = docId;
    this.ydoc = ydoc;
    this.awareness = new Awareness(ydoc);
    this.synced = false;
    this.destroyed = false;
    this.connectSeq = 0;
    // Set once a local change could not be synced; nothing is sent after that.
    this.diverged = false;
    this.retries = 0;
    this.retryTimer = null;
    this.listeners = { synced: new Set(), error: new Set(), status: new Set() };
    this.lastStatus = null;

    this.onDocUpdate = (update, origin) => {
      if (origin === this || this.diverged || !this.synced || !this.socket.connected) return;
      if (update.byteLength > MAX_UPDATE_BYTES) {
        this.markDiverged();
        return;
      }
      const seq = this.connectSeq;
      emitWithAck(this.socket, "doc:update", this.docId, update).then(
        () => this.onSent(seq),
        (error) => this.onFailed(error, seq)
      );
    };

    this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === this || !this.socket.connected) return;
      const changed = added.concat(updated, removed);
      this.socket.emit(
        "doc:awareness",
        this.docId,
        encodeAwarenessUpdate(this.awareness, changed)
      );
    };

    this.onRemoteUpdate = (payload) => {
      if (!payload || String(payload.docId) !== String(this.docId)) return;
      Y.applyUpdate(this.ydoc, toUint8(payload.update), this);
    };

    this.onRemoteAwareness = (payload) => {
      if (!payload || String(payload.docId) !== String(this.docId)) return;
      applyAwarenessUpdate(this.awareness, toUint8(payload.update), this);
    };

    this.onConnect = () => {
      // A fresh connection: start over without waiting out an old backoff.
      this.retries = 0;
      this.resync();
    };

    this.onDisconnect = () => {
      this.synced = false;
      this.emitStatus();
      // Remote cursors are stale once we stop hearing from the room.
      const others = [...this.awareness.getStates().keys()].filter(
        (id) => id !== this.ydoc.clientID
      );
      removeAwarenessStates(this.awareness, others, this);
    };

    ydoc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
    socket.on("doc:update", this.onRemoteUpdate);
    socket.on("doc:awareness", this.onRemoteAwareness);
    socket.on("connect", this.onConnect);
    socket.on("disconnect", this.onDisconnect);
  }

  on(event, cb) {
    this.listeners[event].add(cb);
  }

  off(event, cb) {
    this.listeners[event].delete(cb);
  }

  emitLocal(event, arg) {
    this.listeners[event].forEach((cb) => cb(arg));
  }

  /** What the editor shows: { connected, synced, diverged, retrying }. */
  status() {
    return {
      connected: Boolean(this.socket.connected),
      synced: this.synced,
      diverged: this.diverged,
      // Waiting out a backoff, or re-opening after a failure.
      retrying: this.retryTimer !== null || (this.retries > 0 && !this.synced),
    };
  }

  /** Emit `status` when any of its fields changed since the last one. */
  emitStatus() {
    if (this.destroyed) return;
    const next = this.status();
    const prev = this.lastStatus;
    if (prev && Object.keys(next).every((key) => next[key] === prev[key])) return;
    this.lastStatus = next;
    this.emitLocal("status", next);
  }

  resync() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.synced = false;
    this.emitStatus();
    const seq = this.connectSeq + 1;
    this.connect().catch((error) => this.onFailed(error, seq));
  }

  onSent(seq) {
    if (seq === this.connectSeq) this.retries = 0;
    this.emitStatus();
  }

  /** A doc:open or doc:update failed: retry with backoff, or give up for good. */
  onFailed(error, seq) {
    if (this.destroyed || seq !== this.connectSeq || this.diverged) return;
    const code = error && error.message;
    if (PERMANENT_ERRORS.has(code)) {
      this.markDiverged();
      return;
    }
    if (FATAL_ERRORS.has(code)) {
      // Given up: no retry is pending any more.
      this.retries = 0;
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.synced = false;
      this.emitStatus();
      this.emitLocal("error", error);
      return;
    }
    // Tell the user once per outage, not on every retry.
    if (this.retries === 0) this.emitLocal("error", error);
    console.warn("doc sync failed, retrying:", code);
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** this.retries);
    this.retries++;
    this.synced = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.destroyed && this.socket.connected) this.resync();
      else this.emitStatus();
    }, delay);
    this.emitStatus();
  }

  /**
   * A local change can't reach the server. Every later edit depends on it,
   * so they could never be merged either: stop sending and let the editor
   * ask for a reload rather than drop edits silently.
   */
  markDiverged() {
    if (this.diverged) return;
    this.diverged = true;
    this.synced = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.emitStatus();
    this.emitLocal("error", new Error("diverged"));
  }

  async connect() {
    if (this.destroyed || this.diverged) return;
    const seq = ++this.connectSeq;
    const { update } = await emitWithAck(this.socket, "doc:open", this.docId);
    // A newer connect (or destroy) superseded this one.
    if (this.destroyed || seq !== this.connectSeq) return;

    const serverState = toUint8(update);
    Y.applyUpdate(this.ydoc, serverState, this);
    const missing = Y.encodeStateAsUpdate(
      this.ydoc,
      Y.encodeStateVectorFromUpdate(serverState)
    );
    // No await between the diff and synced=true: any later local edit is
    // emitted live, every earlier one is in the diff.
    if (missing.length > MAX_UPDATE_BYTES) {
      this.markDiverged();
      return;
    }
    if (missing.length > EMPTY_UPDATE_LENGTH) {
      emitWithAck(this.socket, "doc:update", this.docId, missing).then(
        () => this.onSent(seq),
        (error) => this.onFailed(error, seq)
      );
    } else {
      this.retries = 0;
    }
    this.synced = true;
    this.emitStatus();

    if (this.awareness.getLocalState() !== null) {
      this.socket.emit(
        "doc:awareness",
        this.docId,
        encodeAwarenessUpdate(this.awareness, [this.ydoc.clientID])
      );
    }
    this.emitLocal("synced", true);
  }

  destroy() {
    if (this.destroyed) return;
    // Tell the others our cursor is gone while we can still emit.
    removeAwarenessStates(this.awareness, [this.ydoc.clientID], "destroy");
    this.destroyed = true;
    this.synced = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.connectSeq++;
    this.ydoc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.socket.off("doc:update", this.onRemoteUpdate);
    this.socket.off("doc:awareness", this.onRemoteAwareness);
    this.socket.off("connect", this.onConnect);
    this.socket.off("disconnect", this.onDisconnect);
    if (this.socket.connected) {
      emitWithAck(this.socket, "doc:close", this.docId).catch(() => {});
    }
    this.awareness.destroy();
    this.listeners.synced.clear();
    this.listeners.error.clear();
    this.listeners.status.clear();
  }
}
