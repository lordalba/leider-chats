import * as Y from "yjs";
import Workspace from "../../src/models/workspaces/Workspace";
import { yDocManager } from "../../src/services/workspaces/mongoYDocStore";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db";
import { makeChat, makeUser } from "../helpers/fixtures";
import { quietLogs, registerAll } from "../helpers/registerAll";
import { ClientSocket, connectAs, delay, emitAck, record, startTestServer, waitFor } from "../helpers/socketHarness";

/** A minimal client-side Yjs peer: opens the doc and sends/receives updates over the socket. */
const peer = async (client: ClientSocket, docId: string) => {
  const ydoc = new Y.Doc();
  client.on("doc:update", (p: { docId: string; update: ArrayBuffer }) => {
    if (p.docId === docId) Y.applyUpdate(ydoc, new Uint8Array(p.update), "remote");
  });
  const res = await emitAck(client, "doc:open", docId);
  if (!res.ok) throw new Error(res.error);
  Y.applyUpdate(ydoc, new Uint8Array(res.data.update), "remote");
  const sent: Promise<unknown>[] = [];
  ydoc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== "remote") sent.push(emitAck(client, "doc:update", docId, update));
  });
  return { ydoc, text: () => ydoc.getText("quill").toString(), flush: () => Promise.all(sent) };
};

describe("document socket events", () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let restoreLogs: () => void;

  beforeAll(async () => {
    restoreLogs = quietLogs();
    await connectTestDb();
    server = await startTestServer(registerAll);
  });
  afterEach(async () => {
    await yDocManager.flushAll();
    await clearTestDb();
  });
  afterAll(async () => {
    await server.close();
    await disconnectTestDb();
    restoreLogs();
  });

  const setup = async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const c = await makeUser("carol");
    const chat = await makeChat([a, b], [a]);
    const ws = await Workspace.create({ name: "WS", chatRoomId: chat._id, createdBy: a._id });
    const wsId = String(ws._id);
    const A = await connectAs(server.url, String(a._id));
    const B = await connectAs(server.url, String(b._id));
    const C = await connectAs(server.url, String(c._id));
    await emitAck(A, "workspace:join", wsId);
    await emitAck(B, "workspace:join", wsId);
    const created = await emitAck(A, "doc:create", wsId, "Notes");
    if (!created.ok) throw new Error(created.error);
    return { A, B, C, wsId, docId: String(created.data._id) };
  };

  it('A inserts "hi" → B receives doc:update and converges', async () => {
    const { A, B, docId } = await setup();
    const pa = await peer(A, docId);
    const pb = await peer(B, docId);

    const got = waitFor(B, "doc:update");
    pa.ydoc.getText("quill").insert(0, "hi");
    await pa.flush();
    await got;
    await delay(20);
    expect(pb.text()).toBe("hi");
  });

  it("concurrent inserts at position 0 converge to the same string on both", async () => {
    const { A, B, docId } = await setup();
    const pa = await peer(A, docId);
    const pb = await peer(B, docId);

    pa.ydoc.getText("quill").insert(0, "AAA");
    pb.ydoc.getText("quill").insert(0, "BBB");
    await Promise.all([pa.flush(), pb.flush()]);
    await delay(100);

    expect(pa.text()).toBe(pb.text());
    expect(pa.text()).toHaveLength(6);
  });

  it("C (outsider) doc:open → forbidden; C doc:update without open → forbidden", async () => {
    const { C, docId } = await setup();
    expect(await emitAck(C, "doc:open", docId)).toEqual({ ok: false, error: "forbidden" });
    const update = Y.encodeStateAsUpdate(new Y.Doc());
    expect(await emitAck(C, "doc:update", docId, update)).toEqual({ ok: false, error: "forbidden" });
  });

  it("malformed update → invalid, and B receives nothing", async () => {
    const { A, B, docId } = await setup();
    await peer(A, docId);
    await peer(B, docId);
    const received = record(B, "doc:update");
    expect(await emitAck(A, "doc:update", docId, new Uint8Array([1, 2, 3]))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await emitAck(A, "doc:update", docId, "not binary")).toEqual({ ok: false, error: "invalid" });
    await delay(100);
    expect(received).toHaveLength(0);
  });

  it("doc:delete → members receive workspace:item deleted; later doc:open → not_found", async () => {
    const { A, B, docId } = await setup();
    const deleted = waitFor(B, "workspace:item", (p) => p.kind === "document" && p.action === "deleted");
    expect(await emitAck(A, "doc:delete", docId)).toEqual({ ok: true, data: null });
    expect(String((await deleted).item._id)).toBe(docId);
    expect(await emitAck(B, "doc:open", docId)).toEqual({ ok: false, error: "not_found" });
  });

  it("awareness from A is relayed to B but not echoed to A", async () => {
    const { A, B, docId } = await setup();
    await peer(A, docId);
    await peer(B, docId);
    const echoed = record(A, "doc:awareness");
    const got = waitFor(B, "doc:awareness", (p) => p.docId === docId);
    A.emit("doc:awareness", docId, new Uint8Array([9, 9, 9]));
    await got;
    await delay(50);
    expect(echoed).toHaveLength(0);
  });

  it("content persists after everyone closes", async () => {
    const { A, docId } = await setup();
    const pa = await peer(A, docId);
    pa.ydoc.getText("quill").insert(0, "durable");
    await pa.flush();
    expect(await emitAck(A, "doc:close", docId)).toEqual({ ok: true, data: null });

    const again = await peer(A, docId);
    expect(again.text()).toBe("durable");
  });

  it("rename broadcasts an updated item", async () => {
    const { A, B, docId } = await setup();
    const renamed = waitFor(B, "workspace:item", (p) => p.action === "updated" && p.item.title === "Spec");
    expect((await emitAck(A, "doc:rename", docId, "Spec")).ok).toBe(true);
    await renamed;
    expect(await emitAck(A, "doc:rename", docId, "   ")).toEqual({ ok: false, error: "invalid" });
  });
});
