import * as Y from "yjs";
import { YDocManager, YDocStore } from "../../../src/services/workspaces/YDocManager";

class FakeStore implements YDocStore {
  data = new Map<string, Uint8Array>();
  loads = 0;
  saves: { docId: string; state: Uint8Array }[] = [];
  loadDelayMs = 0;

  async load(docId: string): Promise<Uint8Array | null> {
    this.loads++;
    if (this.loadDelayMs) await new Promise((r) => setTimeout(r, this.loadDelayMs));
    return this.data.get(docId) || null;
  }

  async save(docId: string, state: Uint8Array): Promise<void> {
    this.saves.push({ docId, state });
    this.data.set(docId, state);
  }
}

const DOC = "64b000000000000000000001";

function textOf(state: Uint8Array): string {
  const d = new Y.Doc();
  Y.applyUpdate(d, state);
  return d.getText("quill").toString();
}

function insertUpdate(base: Uint8Array | null, index: number, text: string): Uint8Array {
  const d = new Y.Doc();
  if (base) Y.applyUpdate(d, base);
  const before = Y.encodeStateVector(d);
  d.getText("quill").insert(index, text);
  return Y.encodeStateAsUpdate(d, before);
}

afterEach(() => {
  jest.useRealTimers();
});

describe("YDocManager", () => {
  test("two concurrent open() calls for an unloaded doc call store.load exactly once and both get the same state", async () => {
    const store = new FakeStore();
    store.data.set(DOC, insertUpdate(null, 0, "seed"));
    store.loadDelayMs = 20;
    const m = new YDocManager(store);
    const [s1, s2] = await Promise.all([m.open(DOC, "s1"), m.open(DOC, "s2")]);
    expect(store.loads).toBe(1);
    expect(textOf(s1)).toBe("seed");
    expect(textOf(s2)).toBe("seed");
    // An update applied after both opens is seen by the single loaded doc.
    m.applyUpdate(DOC, insertUpdate(s1, 4, "!"));
    await m.close(DOC, "s1");
    expect(m.isLoaded(DOC)).toBe(true);
    await m.close(DOC, "s2");
    expect(textOf(store.data.get(DOC)!)).toBe("seed!");
  });

  test("applyUpdate then 2000 ms → store.save called once with state containing the text", async () => {
    jest.useFakeTimers();
    const store = new FakeStore();
    const m = new YDocManager(store);
    const client = new Y.Doc();
    Y.applyUpdate(client, await m.open(DOC, "s1"));
    client.on("update", (u: Uint8Array) => m.applyUpdate(DOC, u));
    client.getText("quill").insert(0, "a");
    jest.advanceTimersByTime(1000);
    client.getText("quill").insert(1, "b");
    jest.advanceTimersByTime(1999);
    expect(store.saves).toHaveLength(0);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(store.saves).toHaveLength(1);
    expect(textOf(store.saves[0].state)).toBe("ab");
  });

  test("last close flushes immediately and evicts; reopen loads the saved state", async () => {
    const store = new FakeStore();
    const m = new YDocManager(store);
    const state = await m.open(DOC, "s1");
    m.applyUpdate(DOC, insertUpdate(state, 0, "hello"));
    await m.close(DOC, "s1");
    expect(store.saves).toHaveLength(1);
    expect(m.isLoaded(DOC)).toBe(false);
    const reopened = await m.open(DOC, "s2");
    expect(store.loads).toBe(2);
    expect(textOf(reopened)).toBe("hello");
  });

  test("malformed update (Uint8Array [1,2,3]) → invalid, and the subsequent state equals the prior state", async () => {
    const store = new FakeStore();
    store.data.set(DOC, insertUpdate(null, 0, "keep"));
    const m = new YDocManager(store);
    const before = await m.open(DOC, "s1");
    expect(() => m.applyUpdate(DOC, new Uint8Array([1, 2, 3]))).toThrow(
      expect.objectContaining({ code: "invalid" })
    );
    const after = await m.open(DOC, "s1");
    expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
    expect(textOf(after)).toBe("keep");
  });

  test("applyUpdate on a doc that is not loaded → not_found", () => {
    const m = new YDocManager(new FakeStore());
    expect(() => m.applyUpdate(DOC, insertUpdate(null, 0, "x"))).toThrow(
      expect.objectContaining({ code: "not_found" })
    );
  });

  test("delete() cancels a pending save", async () => {
    jest.useFakeTimers();
    const store = new FakeStore();
    const m = new YDocManager(store);
    const state = await m.open(DOC, "s1");
    m.applyUpdate(DOC, insertUpdate(state, 0, "gone"));
    m.delete(DOC);
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(store.saves).toHaveLength(0);
    expect(m.isLoaded(DOC)).toBe(false);
  });

  test("closeSocket closes every doc the socket had open; flushAll saves dirty docs", async () => {
    const store = new FakeStore();
    const m = new YDocManager(store);
    const other = "64b000000000000000000002";
    const s1 = await m.open(DOC, "s1");
    await m.open(other, "s1");
    await m.open(other, "s2");
    m.applyUpdate(DOC, insertUpdate(s1, 0, "x"));
    await m.closeSocket("s1");
    expect(m.isLoaded(DOC)).toBe(false);
    expect(m.isLoaded(other)).toBe(true);
    expect(textOf(store.data.get(DOC)!)).toBe("x");
    const so = await m.open(other, "s2");
    m.applyUpdate(other, insertUpdate(so, 0, "y"));
    await m.flushAll();
    expect(textOf(store.data.get(other)!)).toBe("y");
  });
});
