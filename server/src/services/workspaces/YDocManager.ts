import * as Y from "yjs";
import { WorkspaceError } from "./WorkspaceAccess";

export interface YDocStore {
  load(docId: string): Promise<Uint8Array | null>;
  save(docId: string, state: Uint8Array): Promise<void>;
}

type Entry = {
  ydoc: Y.Doc;
  sockets: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  loading: Promise<void> | null;
  dirty: boolean;
};

/**
 * Keeps one in-memory Y.Doc per open document, applies incoming updates to it,
 * and persists its full state to the store (debounced, and on last close).
 */
export class YDocManager {
  private docs = new Map<string, Entry>();
  private saveDebounceMs: number;

  constructor(private store: YDocStore, opts: { saveDebounceMs?: number } = {}) {
    this.saveDebounceMs = opts.saveDebounceMs ?? 2000;
  }

  /** Loads the doc if needed (exactly one store.load for concurrent callers) and returns its full state. */
  async open(docId: string, socketId: string): Promise<Uint8Array> {
    let entry = this.docs.get(docId);
    if (!entry) {
      const created: Entry = {
        ydoc: new Y.Doc(),
        sockets: new Set(),
        timer: null,
        loading: null,
        dirty: false,
      };
      created.loading = (async () => {
        const state = await this.store.load(docId);
        if (state && state.length > 0) Y.applyUpdate(created.ydoc, state);
      })();
      this.docs.set(docId, created);
      entry = created;
      try {
        await created.loading;
      } catch (err) {
        if (this.docs.get(docId) === created) this.docs.delete(docId);
        throw err;
      } finally {
        created.loading = null;
      }
    } else if (entry.loading) {
      await entry.loading;
    }

    // The doc may have been deleted while we were waiting for the load.
    if (this.docs.get(docId) !== entry) throw new WorkspaceError("not_found");
    entry.sockets.add(socketId);
    return Y.encodeStateAsUpdate(entry.ydoc);
  }

  /** Applies a Yjs update. Malformed updates throw `invalid` and leave the doc unchanged. */
  applyUpdate(docId: string, update: Uint8Array): void {
    const entry = this.docs.get(docId);
    if (!entry || entry.loading) throw new WorkspaceError("not_found");
    if (!(update instanceof Uint8Array) || update.length === 0) {
      throw new WorkspaceError("invalid");
    }
    try {
      // Decoding first rejects truncated or garbage updates before they touch the doc.
      Y.decodeUpdate(update);
    } catch {
      throw new WorkspaceError("invalid");
    }

    try {
      Y.applyUpdate(entry.ydoc, update);
    } catch {
      throw new WorkspaceError("invalid");
    }
    this.scheduleSave(docId, entry);
  }

  /** Removes the socket; when it was the last one, flushes and evicts the doc from memory. */
  async close(docId: string, socketId: string): Promise<void> {
    const entry = this.docs.get(docId);
    if (!entry) return;
    entry.sockets.delete(socketId);
    if (entry.sockets.size > 0 || entry.loading) return;

    await this.flush(docId);
    // Someone may have re-opened it while we were saving.
    if (this.docs.get(docId) === entry && entry.sockets.size === 0) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.ydoc.destroy();
      this.docs.delete(docId);
    }
  }

  async closeSocket(socketId: string): Promise<void> {
    const docIds: string[] = [];
    for (const [docId, entry] of this.docs) {
      if (entry.sockets.has(socketId)) docIds.push(docId);
    }
    await Promise.all(docIds.map((docId) => this.close(docId, socketId)));
  }

  /** Drops the doc without saving (used when the document is deleted). */
  delete(docId: string): void {
    const entry = this.docs.get(docId);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.dirty = false;
    entry.ydoc.destroy();
    this.docs.delete(docId);
  }

  async flushAll(): Promise<void> {
    await Promise.all(Array.from(this.docs.keys()).map((docId) => this.flush(docId)));
  }

  isLoaded(docId: string): boolean {
    const entry = this.docs.get(docId);
    return !!entry && !entry.loading;
  }

  private scheduleSave(docId: string, entry: Entry): void {
    entry.dirty = true;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      this.flush(docId).catch((err) => console.error("[ydoc] save failed:", err));
    }, this.saveDebounceMs);
  }

  private async flush(docId: string): Promise<void> {
    const entry = this.docs.get(docId);
    if (!entry || !entry.dirty) return;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.dirty = false;
    const state = Y.encodeStateAsUpdate(entry.ydoc);
    try {
      await this.store.save(docId, state);
    } catch (err) {
      entry.dirty = true;
      throw err;
    }
  }
}
