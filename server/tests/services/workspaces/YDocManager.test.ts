import * as Y from "yjs";
import { YDocManager, YDocStore } from "../../../src/services/workspaces/YDocManager";
import { WorkspaceError } from "../../../src/services/workspaces/WorkspaceAccess";

const makeStore = (initial: Record<string, Uint8Array> = {}) => {
  const data: Record<string, Uint8Array> = { ...initial };
  const store: YDocStore & { loads: number; saves: number; data: typeof data } = {
    loads: 0,
    saves: 0,
    data,
    async load(docId) {
      store.loads += 1;
      await new Promise((r) => setImmediate(r));
      return data[docId] || null;
    },
    async save(docId, state) {
      store.saves += 1;
      data[docId] = state;
    },
  };
  return store;
};

const textOf = (state: Uint8Array) => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  return doc.getText("quill").toString();
};

const insertUpdate = (base: Uint8Array, index: number, text: string) => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, base);
  const before = Y.encodeStateVector(doc);
  doc.getText("quill").insert(index, text);
  return Y.encodeStateAsUpdate(doc, before);
};

describe("YDocManager", () => {
  afterEach(() => jest.useRealTimers());

  it("Review Focus 2: two concurrent open() calls load exactly once and get the same state", async () => {
    const seed = new Y.Doc();
    seed.getText("quill").insert(0, "seeded");
    const store = makeStore({ d1: Y.encodeStateAsUpdate(seed) });
    const manager = new YDocManager(store);

    const [s1, s2] = await Promise.all([manager.open("d1", "a"), manager.open("d1", "b")]);
    expect(store.loads).toBe(1);
    expect(textOf(s1)).toBe("seeded");
    expect(textOf(s2)).toBe("seeded");

    // No update is lost: both sockets' edits land in the one shared doc.
    manager.applyUpdate("d1", insertUpdate(s1, 0, "A"));
    manager.applyUpdate("d1", insertUpdate(s2, 6, "B"));
    const final = textOf(await manager.open("d1", "c"));
    expect(final).toContain("A");
    expect(final).toContain("B");
    expect(store.loads).toBe(1);
  });

  it("debounces saves: several updates inside 2000 ms give one save containing the text", async () => {
    const store = makeStore();
    const manager = new YDocManager(store);
    const state = await manager.open("d1", "a");

    jest.useFakeTimers();
    manager.applyUpdate("d1", insertUpdate(state, 0, "he"));
    jest.advanceTimersByTime(1000);
    const mid = await manager.open("d1", "a");
    manager.applyUpdate("d1", insertUpdate(mid, 2, "llo"));
    jest.advanceTimersByTime(1999);
    expect(store.saves).toBe(0);
    jest.advanceTimersByTime(1);
    expect(store.saves).toBe(1);
    expect(textOf(store.data.d1)).toBe("hello");
  });

  it("last close flushes immediately and evicts; reopen loads the saved state", async () => {
    const store = makeStore();
    const manager = new YDocManager(store);
    const state = await manager.open("d1", "a");
    await manager.open("d1", "b");
    manager.applyUpdate("d1", insertUpdate(state, 0, "persist me"));

    await manager.close("d1", "a");
    expect(manager.isLoaded("d1")).toBe(true);
    expect(store.saves).toBe(0);

    await manager.close("d1", "b");
    expect(manager.isLoaded("d1")).toBe(false);
    expect(store.saves).toBe(1);

    const reopened = await manager.open("d1", "c");
    expect(textOf(reopened)).toBe("persist me");
    expect(store.loads).toBe(2);
  });

  it("malformed update → invalid, and the state is unchanged", async () => {
    const store = makeStore();
    const manager = new YDocManager(store);
    const state = await manager.open("d1", "a");
    manager.applyUpdate("d1", insertUpdate(state, 0, "keep"));
    const before = await manager.open("d1", "a");

    expect(() => manager.applyUpdate("d1", new Uint8Array([1, 2, 3]))).toThrow(WorkspaceError);
    try {
      manager.applyUpdate("d1", new Uint8Array([1, 2, 3]));
    } catch (err) {
      expect((err as WorkspaceError).code).toBe("invalid");
    }
    expect(() => manager.applyUpdate("d1", new Uint8Array([]))).toThrow(WorkspaceError);
    const after = await manager.open("d1", "a");
    expect(textOf(after)).toBe(textOf(before));
  });

  it("applyUpdate on a doc that is not loaded → not_found", () => {
    const manager = new YDocManager(makeStore());
    expect(() => manager.applyUpdate("nope", new Uint8Array([0, 0]))).toThrow(WorkspaceError);
  });

  it("delete() cancels a pending save", async () => {
    const store = makeStore();
    const manager = new YDocManager(store);
    const state = await manager.open("d1", "a");
    jest.useFakeTimers();
    manager.applyUpdate("d1", insertUpdate(state, 0, "gone"));
    manager.delete("d1");
    jest.advanceTimersByTime(5000);
    expect(store.saves).toBe(0);
    expect(manager.isLoaded("d1")).toBe(false);
  });

  it("closeSocket closes every doc of that socket", async () => {
    const store = makeStore();
    const manager = new YDocManager(store);
    await manager.open("d1", "a");
    await manager.open("d2", "a");
    await manager.open("d2", "b");
    await manager.closeSocket("a");
    expect(manager.isLoaded("d1")).toBe(false);
    expect(manager.isLoaded("d2")).toBe(true);
  });
});
