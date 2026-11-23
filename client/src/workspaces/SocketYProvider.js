import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { emitWithAck } from "../socket/socketCall";

const REMOTE = "remote";

const toBytes = (value) => (value instanceof Uint8Array ? value : new Uint8Array(value));

/**
 * Syncs a Y.Doc over the app's Socket.IO connection using the doc:* events.
 *
 * - connect(): doc:open → apply server state → send the local edits the server lacks.
 * - Local updates are sent as doc:update while synced and connected. Edits made while offline
 *   are not sent one by one; the diff on reconnect covers them.
 * - Re-syncs automatically on the socket's `connect` event and after a rejected update.
 */
export class SocketYProvider {
  constructor(socket, docId, ydoc) {
    this.socket = socket;
    this.docId = docId;
    this.doc = ydoc;
    this.awareness = new Awareness(ydoc);
    this.synced = false;
    this._destroyed = false;
    this._connecting = null;
    this._listeners = {};

    this._onLocalUpdate = (update, origin) => {
      if (origin === this || !this.synced || !this.socket.connected) return;
      emitWithAck(this.socket, "doc:update", this.docId, update).catch(() => {
        // The server did not take it: resync so nothing is lost.
        this._resync();
      });
    };

    this._onRemoteUpdate = ({ docId, update }) => {
      if (docId !== this.docId) return;
      Y.applyUpdate(this.doc, toBytes(update), this);
    };

    this._onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === REMOTE) return;
      this._sendAwareness(added.concat(updated, removed));
    };

    this._onAwarenessChange = ({ added }, origin) => {
      // Someone new appeared: tell them about us so their cursors view is complete.
      if (origin === REMOTE && added.length > 0) this._sendAwareness([this.doc.clientID]);
    };

    this._onRemoteAwareness = ({ docId, update }) => {
      if (docId !== this.docId) return;
      applyAwarenessUpdate(this.awareness, toBytes(update), REMOTE);
    };

    this._onConnect = () => this._resync();
    this._onDisconnect = () => this._setSynced(false);

    this.doc.on("update", this._onLocalUpdate);
    this.awareness.on("update", this._onAwarenessUpdate);
    this.awareness.on("change", this._onAwarenessChange);
    this.socket.on("doc:update", this._onRemoteUpdate);
    this.socket.on("doc:awareness", this._onRemoteAwareness);
    this.socket.on("connect", this._onConnect);
    this.socket.on("disconnect", this._onDisconnect);
  }

  on(event, cb) {
    (this._listeners[event] = this._listeners[event] || []).push(cb);
  }

  off(event, cb) {
    this._listeners[event] = (this._listeners[event] || []).filter((fn) => fn !== cb);
  }

  _emit(event, ...args) {
    (this._listeners[event] || []).slice().forEach((fn) => fn(...args));
  }

  _setSynced(value) {
    if (this.synced === value) return;
    this.synced = value;
    if (value) this._emit("synced", true);
  }

  _sendAwareness(clients) {
    if (this._destroyed || !this.socket.connected || clients.length === 0) return;
    this.socket.emit("doc:awareness", this.docId, encodeAwarenessUpdate(this.awareness, clients));
  }

  _resync() {
    if (this._destroyed) return;
    this._setSynced(false);
    this.connect().catch((err) => this._emit("error", err));
  }

  /** Opens the doc on the server and exchanges state. Concurrent calls share one attempt. */
  connect() {
    if (this._connecting) return this._connecting;
    this._connecting = (async () => {
      try {
        const { update } = await emitWithAck(this.socket, "doc:open", this.docId);
        if (this._destroyed) return;
        const serverState = toBytes(update);
        Y.applyUpdate(this.doc, serverState, this);

        // Everything local the server lacks (e.g. edits made while offline).
        const missing = Y.encodeStateAsUpdate(this.doc, Y.encodeStateVectorFromUpdate(serverState));
        // From here on, local edits are streamed. Emits keep their order, so they follow `missing`.
        this._setSynced(true);
        this._sendAwareness([this.doc.clientID]);
        // An empty update is 2 bytes ([0, 0]); skip the round trip when there's nothing to send.
        if (missing.length > 2) {
          try {
            await emitWithAck(this.socket, "doc:update", this.docId, missing);
          } catch (err) {
            this._setSynced(false);
            throw err;
          }
        }
      } finally {
        this._connecting = null;
      }
    })();
    return this._connecting;
  }

  destroy() {
    if (this._destroyed) return;
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local");
    this._destroyed = true;
    if (this.socket.connected) {
      emitWithAck(this.socket, "doc:close", this.docId).catch(() => {});
    }
    this.doc.off("update", this._onLocalUpdate);
    this.awareness.off("update", this._onAwarenessUpdate);
    this.awareness.off("change", this._onAwarenessChange);
    this.socket.off("doc:update", this._onRemoteUpdate);
    this.socket.off("doc:awareness", this._onRemoteAwareness);
    this.socket.off("connect", this._onConnect);
    this.socket.off("disconnect", this._onDisconnect);
    this.awareness.destroy();
    this._listeners = {};
  }
}
