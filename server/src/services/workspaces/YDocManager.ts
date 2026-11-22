import * as Y from "yjs";
import { WorkspaceError } from "./WorkspaceAccess";
import { mongoYDocStore } from "./mongoYDocStore";

export interface YDocStore {
  load(docId: string): Promise<Uint8Array | null>;
  save(docId: string, state: Uint8Array): Promise<void>;
}

interface Entry {
  ydoc: Y.Doc;
  sockets: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
}

/**
 * Holds the live Y.Doc of every open document: loads it once (concurrent
 * opens share one load), applies client updates, persists on a debounce and
 * on the last close, and evicts it when no socket has it open.
 */
export class YDocManager {
  private docs = new Map<string, Entry>();
  private loading = new Map<string, Promise<Entry>>();
  private readonly saveDebounceMs: number;

  constructor(private store: YDocStore, opts: { saveDebounceMs?: number } = {}) {
    this.saveDebounceMs = opts.saveDebounceMs ?? 2000;
  }

  isLoaded(docId: string): boolean {
    return this.docs.has(docId);
  }

  async open(docId: string, socketId: string): Promise<Uint8Array> {
    const entry = await this.load(docId);
    entry.sockets.add(socketId);
    return Y.encodeStateAsUpdate(entry.ydoc);
  }

  private load(docId: string): Promise<Entry> {
    const loaded = this.docs.get(docId);
    if (loaded) return Promise.resolve(loaded);
    let pending = this.loading.get(docId);
    if (!pending) {
      pending = (async () => {
        try {
          const state = await this.store.load(docId);
          const ydoc = new Y.Doc();
          if (state) Y.applyUpdate(ydoc, state);
          const entry: Entry = { ydoc, sockets: new Set(), timer: null, dirty: false };
          this.docs.set(docId, entry);
          return entry;
        } finally {
          this.loading.delete(docId);
        }
      })();
      this.loading.set(docId, pending);
    }
    return pending;
  }

  applyUpdate(docId: string, update: Uint8Array): void {
    const entry = this.docs.get(docId);
    if (!entry) throw new WorkspaceError("not_found");
    if (!(update instanceof Uint8Array) || update.length === 0) {
      throw new WorkspaceError("invalid");
    }
    try {
      // Decoding first rejects garbage before it touches the live doc.
      Y.decodeUpdate(update);
    } catch {
      throw new WorkspaceError("invalid");
    }
    try {
      Y.applyUpdate(entry.ydoc, update);
    } catch {
      throw new WorkspaceError("invalid");
    }
    entry.dirty = true;
    this.schedule(docId, entry);
  }

  private schedule(docId: string, entry: Entry): void {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      this.flush(docId).catch((error) =>
        console.error(`ydoc save failed for ${docId}:`, error)
      );
    }, this.saveDebounceMs);
  }

  private async flush(docId: string): Promise<void> {
    const entry = this.docs.get(docId);
    if (!entry) return;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (!entry.dirty) return;
    entry.dirty = false;
    try {
      await this.store.save(docId, Y.encodeStateAsUpdate(entry.ydoc));
    } catch (error) {
      entry.dirty = true;
      throw error;
    }
  }

  async close(docId: string, socketId: string): Promise<void> {
    const entry = this.docs.get(docId);
    if (!entry || !entry.sockets.delete(socketId)) return;
    if (entry.sockets.size > 0) return;
    try {
      await this.flush(docId);
    } finally {
      // Re-check: a socket may have re-opened the doc during the save.
      if (this.docs.get(docId) === entry && entry.sockets.size === 0) {
        if (entry.timer) clearTimeout(entry.timer);
        this.docs.delete(docId);
        entry.ydoc.destroy();
      }
    }
  }

  async closeSocket(socketId: string): Promise<void> {
    const open = [...this.docs.entries()]
      .filter(([, entry]) => entry.sockets.has(socketId))
      .map(([docId]) => docId);
    await Promise.all(open.map((docId) => this.close(docId, socketId)));
  }

  /** Drop a document without saving (it was deleted). */
  delete(docId: string): void {
    const entry = this.docs.get(docId);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.docs.delete(docId);
    entry.ydoc.destroy();
  }

  async flushAll(): Promise<void> {
    await Promise.all(
      [...this.docs.keys()].map((docId) =>
        this.flush(docId).catch((error) =>
          console.error(`ydoc save failed for ${docId}:`, error)
        )
      )
    );
  }
}

export const yDocManager = new YDocManager(mongoYDocStore);
