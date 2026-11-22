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
    this.listeners = { synced: new Set(), error: new Set() };

    this.onDocUpdate = (update, origin) => {
      if (origin === this || !this.synced || !this.socket.connected) return;
      if (update.byteLength > MAX_UPDATE_BYTES) {
        this.emitLocal("error", new Error("too_large"));
        return;
      }
      emitWithAck(this.socket, "doc:update", this.docId, update).catch((error) => {
        if (this.destroyed) return;
        // A lost update would otherwise stay unsent until the next reconnect.
        console.warn("doc:update failed, resyncing:", error.message);
        this.resync();
      });
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

    this.onConnect = () => this.resync();

    this.onDisconnect = () => {
      this.synced = false;
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

  resync() {
    this.synced = false;
    this.connect().catch((error) => {
      if (!this.destroyed) this.emitLocal("error", error);
    });
  }

  async connect() {
    if (this.destroyed) return;
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
      this.emitLocal("error", new Error("too_large"));
    } else if (missing.length > EMPTY_UPDATE_LENGTH) {
      emitWithAck(this.socket, "doc:update", this.docId, missing).catch((error) => {
        if (this.destroyed || seq !== this.connectSeq) return;
        console.warn("doc:update (resync diff) failed, retrying:", error.message);
        this.resync();
      });
    }
    this.synced = true;

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
  }
}
