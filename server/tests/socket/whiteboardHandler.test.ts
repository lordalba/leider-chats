import Workspace from "../../src/models/workspaces/Workspace";
import Whiteboard from "../../src/models/workspaces/Whiteboard";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db";
import { makeChat, makeUser } from "../helpers/fixtures";
import { quietLogs, registerAll } from "../helpers/registerAll";
import { connectAs, delay, emitAck, startTestServer, waitFor } from "../helpers/socketHarness";

const stroke = (id: string) => ({ id, color: "#112233", width: 3, points: [0.1, 0.1, 0.9, 0.9] });

describe("whiteboard socket events", () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let restoreLogs: () => void;

  beforeAll(async () => {
    restoreLogs = quietLogs();
    await connectTestDb();
    server = await startTestServer(registerAll);
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    await server.close();
    await disconnectTestDb();
    restoreLogs();
  });

  // alice is the chat admin; bob creates the board; dave is a plain member.
  const setup = async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");
    const dave = await makeUser("dave");
    const chat = await makeChat([alice, bob, dave], [alice]);
    const ws = await Workspace.create({ name: "WS", chatRoomId: chat._id, createdBy: alice._id });
    const wsId = String(ws._id);
    const A = await connectAs(server.url, String(alice._id));
    const B = await connectAs(server.url, String(bob._id));
    const D = await connectAs(server.url, String(dave._id));
    for (const c of [A, B, D]) await emitAck(c, "workspace:join", wsId);
    const created = await emitAck(B, "wb:create", wsId, "Sketch");
    if (!created.ok) throw new Error(created.error);
    const wbId = String(created.data._id);
    for (const c of [A, B, D]) await emitAck(c, "wb:open", wbId);
    return { A, B, D, wsId, wbId };
  };

  it("A wb:stroke → B receives wb:stroke; reopen returns it", async () => {
    const { A, B, wbId } = await setup();
    const got = waitFor(B, "wb:stroke", (p) => p.stroke.id === "s1");
    const res = await emitAck(A, "wb:stroke", wbId, stroke("s1"));
    expect(res.ok).toBe(true);
    await got;
    const reopened = await emitAck(B, "wb:open", wbId);
    expect(reopened.ok && reopened.data.strokes.map((s: any) => s.id)).toEqual(["s1"]);
  });

  it("B wb:undo of A's stroke → not_found and the stroke remains; A can undo it", async () => {
    const { A, B, wbId } = await setup();
    await emitAck(A, "wb:stroke", wbId, stroke("s1"));
    expect(await emitAck(B, "wb:undo", wbId, "s1")).toEqual({ ok: false, error: "not_found" });
    let wb = await Whiteboard.findById(wbId).select("+strokes");
    expect(wb!.strokes).toHaveLength(1);

    const removed = waitFor(B, "wb:stroke-removed", (p) => p.strokeId === "s1");
    expect(await emitAck(A, "wb:undo", wbId, "s1")).toEqual({ ok: true, data: null });
    await removed;
    wb = await Whiteboard.findById(wbId).select("+strokes");
    expect(wb!.strokes).toHaveLength(0);
  });

  it("plain member wb:clear on a board they did not create → forbidden; creator → others receive wb:cleared", async () => {
    const { A, B, D, wbId } = await setup();
    await emitAck(A, "wb:stroke", wbId, stroke("s1"));
    expect(await emitAck(D, "wb:clear", wbId)).toEqual({ ok: false, error: "forbidden" });

    const cleared = waitFor(A, "wb:cleared", (p) => p.whiteboardId === wbId);
    expect(await emitAck(B, "wb:clear", wbId)).toEqual({ ok: true, data: null });
    await cleared;
  });

  it("chat admin may clear a board they did not create", async () => {
    const { A, wbId } = await setup();
    expect(await emitAck(A, "wb:clear", wbId)).toEqual({ ok: true, data: null });
  });

  it("5001st stroke → board_full", async () => {
    const { A, wbId } = await setup();
    const seeded = Array.from({ length: 5000 }, (_, i) => ({
      ...stroke(`seed-${i}`),
      userId: "seed",
      createdAt: new Date(),
    }));
    await Whiteboard.updateOne({ _id: wbId }, { $set: { strokes: seeded } });
    expect(await emitAck(A, "wb:stroke", wbId, stroke("one-too-many"))).toEqual({
      ok: false,
      error: "board_full",
    });
  });

  it("wb:drawing reaches B and is not persisted", async () => {
    const { A, B, wbId } = await setup();
    const got = waitFor(B, "wb:drawing", (p) => p.strokeId === "live");
    A.emit("wb:drawing", wbId, { strokeId: "live", color: "#000000", width: 2, points: [0, 0, 0.2, 0.2] });
    const payload = await got;
    expect(payload.whiteboardId).toBe(wbId);
    await delay(50);
    const wb = await Whiteboard.findById(wbId).select("+strokes");
    expect(wb!.strokes).toHaveLength(0);
  });

  it("invalid stroke → invalid; stroke without opening → forbidden", async () => {
    const { A, wsId } = await setup();
    const other = await emitAck(A, "wb:create", wsId, "Other");
    const otherId = other.ok ? String(other.data._id) : "";
    expect(await emitAck(A, "wb:stroke", otherId, stroke("x"))).toEqual({ ok: false, error: "forbidden" });
    await emitAck(A, "wb:open", otherId);
    expect(await emitAck(A, "wb:stroke", otherId, { ...stroke("x"), points: [5, 5] })).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
