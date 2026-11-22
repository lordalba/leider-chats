import { Socket as ClientSocket } from "socket.io-client";
import { startTestServer, connectAs } from "../helpers/socketHarness";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser, makeChat } from "../helpers/fixtures";
import workspaceHandler from "../../src/socketHandlers/workspaces/workspaceHandler";
import whiteboardHandler from "../../src/socketHandlers/workspaces/whiteboardHandler";
import connectionHandler from "../../src/socketHandlers/connectionHandler";
import { WorkspacePresenceService } from "../../src/services/workspaces/WorkspacePresenceService";
import Workspace from "../../src/models/workspaces/Workspace";
import Whiteboard from "../../src/models/workspaces/whiteboard";

let server: Awaited<ReturnType<typeof startTestServer>>;
let clients: ClientSocket[] = [];

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  await connectTestDb();
  server = await startTestServer((io, socket) => {
    connectionHandler(io, socket);
    workspaceHandler(io, socket);
    whiteboardHandler(io, socket);
  });
});
beforeEach(() => WorkspacePresenceService.reset());
afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  await new Promise((r) => setTimeout(r, 50));
  await clearTestDb();
});
afterAll(async () => {
  await server.close();
  await disconnectTestDb();
  jest.restoreAllMocks();
});

function waitFor<T = any>(socket: ClientSocket, event: string, predicate: (d: T) => boolean = () => true, timeout = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);
    const handler = (data: T) => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    socket.on(event, handler);
  });
}

function expectNoEvent(socket: ClientSocket, event: string, ms = 300): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      clearTimeout(timer);
      socket.off(event, handler);
      reject(new Error(`unexpected ${event}`));
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
    socket.on(event, handler);
  });
}

const emit = (s: ClientSocket, ev: string, ...args: unknown[]): Promise<any> =>
  new Promise((r) => s.emit(ev, ...args, r));

async function connect(userId: string) {
  const c = await connectAs(server.url, userId);
  clients.push(c);
  return c;
}

const stroke = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  color: "#112233",
  width: 3,
  points: [0.1, 0.1, 0.2, 0.2],
  ...extra,
});

/** alice (admin, board creator unless creator=bob), bob (member), carol (outsider), dave (member). */
async function setup(creator: "alice" | "bob" = "alice") {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const carol = await makeUser("carol");
  const dave = await makeUser("dave");
  const chat = await makeChat([alice, bob, dave], [alice]);
  const ws = await Workspace.create({ name: "W", chatRoomId: chat._id, createdBy: alice._id });
  const wsId = String(ws._id);
  const A = await connect(String(alice._id));
  const B = await connect(String(bob._id));
  const C = await connect(String(carol._id));
  const D = await connect(String(dave._id));
  for (const s of [A, B, D]) expect((await emit(s, "workspace:join", wsId)).ok).toBe(true);
  const maker = creator === "alice" ? A : B;
  const created = await emit(maker, "wb:create", wsId, "Board");
  expect(created.ok).toBe(true);
  const wbId = String(created.data._id);
  for (const s of [A, B, D]) expect((await emit(s, "wb:open", wbId)).ok).toBe(true);
  return { wsId, wbId, A, B, C, D, alice, bob };
}

describe("whiteboardHandler", () => {
  test("wb:create returns item meta and broadcasts workspace:item; rename/delete broadcast", async () => {
    const { wbId, B, D } = await setup();
    let p = waitFor(D, "workspace:item", (d) => d.kind === "whiteboard" && d.action === "updated");
    const renamed = await emit(B, "wb:rename", wbId, " Sketch ");
    expect(renamed.ok).toBe(true);
    expect(Object.keys(renamed.data).sort()).toEqual(["_id", "title", "updatedAt"]);
    expect((await p).item.title).toBe("Sketch");
    expect(await emit(B, "wb:rename", wbId, "")).toEqual({ ok: false, error: "invalid" });

    p = waitFor(D, "workspace:item", (d) => d.kind === "whiteboard" && d.action === "deleted");
    expect(await emit(B, "wb:delete", wbId)).toEqual({ ok: true, data: null });
    expect((await p).item).toEqual({ _id: wbId });
    expect(await emit(D, "wb:open", wbId)).toEqual({ ok: false, error: "not_found" });
    expect((await emit(D, "wb:stroke", wbId, stroke("after"))).ok).toBe(false);
  });

  test("A wb:stroke → B receives wb:stroke; reopen returns it", async () => {
    const { wbId, A, B } = await setup();
    const echo = expectNoEvent(A, "wb:stroke");
    const got = waitFor(B, "wb:stroke");
    const res = await emit(A, "wb:stroke", wbId, stroke("s1", { userId: "forged" }));
    expect(res.ok).toBe(true);
    const ev = await got;
    expect(ev.whiteboardId).toBe(wbId);
    expect(ev.stroke).toMatchObject({ id: "s1", color: "#112233", width: 3, points: [0.1, 0.1, 0.2, 0.2] });
    expect(ev.stroke.userId).toBe(res.data.userId);
    expect(ev.stroke.userId).not.toBe("forged");
    await echo;
    const reopened = await emit(B, "wb:open", wbId);
    expect(reopened.data.strokes.map((s: any) => s.id)).toEqual(["s1"]);
    // Strokes aren't loaded on plain reads.
    expect((await Whiteboard.findById(wbId).lean() as any).strokes).toBeUndefined();
  });

  test("invalid stroke → invalid and nothing stored", async () => {
    const { wbId, A } = await setup();
    expect(await emit(A, "wb:stroke", wbId, stroke("s1", { points: [0, 0, 1] }))).toEqual({ ok: false, error: "invalid" });
    expect(await emit(A, "wb:stroke", "nope", stroke("s1"))).toEqual({ ok: false, error: "not_found" });
    expect((await emit(A, "wb:open", wbId)).data.strokes).toEqual([]);
  });

  test("outsider can't open or write; member that never opened can't stroke", async () => {
    const { wsId, wbId, C } = await setup();
    expect(await emit(C, "wb:open", wbId)).toEqual({ ok: false, error: "forbidden" });
    expect(await emit(C, "wb:stroke", wbId, stroke("x"))).toEqual({ ok: false, error: "forbidden" });
    expect(await emit(C, "wb:create", wsId, "Mine")).toEqual({ ok: false, error: "forbidden" });
    expect(await emit(C, "wb:clear", wbId)).toEqual({ ok: false, error: "forbidden" });
  });

  test("B wb:undo of A's stroke → not_found and the stroke remains; A's undo broadcasts wb:stroke-removed", async () => {
    const { wbId, A, B } = await setup();
    expect((await emit(A, "wb:stroke", wbId, stroke("s1"))).ok).toBe(true);
    expect(await emit(B, "wb:undo", wbId, "s1")).toEqual({ ok: false, error: "not_found" });
    expect((await emit(B, "wb:open", wbId)).data.strokes).toHaveLength(1);

    const got = waitFor(B, "wb:stroke-removed");
    expect(await emit(A, "wb:undo", wbId, "s1")).toEqual({ ok: true, data: null });
    expect(await got).toEqual({ whiteboardId: wbId, strokeId: "s1" });
    expect((await emit(B, "wb:open", wbId)).data.strokes).toHaveLength(0);
  });

  test("plain member wb:clear on a board they did not create → forbidden; creator → B receives wb:cleared", async () => {
    const { wbId, A, B, D } = await setup("bob");
    expect((await emit(A, "wb:stroke", wbId, stroke("s1"))).ok).toBe(true);
    expect(await emit(D, "wb:clear", wbId)).toEqual({ ok: false, error: "forbidden" });
    expect((await emit(D, "wb:open", wbId)).data.strokes).toHaveLength(1);

    let got = waitFor(A, "wb:cleared");
    expect(await emit(B, "wb:clear", wbId)).toEqual({ ok: true, data: null });
    expect(await got).toEqual({ whiteboardId: wbId });
    expect((await emit(D, "wb:open", wbId)).data.strokes).toHaveLength(0);

    // A chat admin (alice) may clear a board someone else created.
    expect((await emit(D, "wb:stroke", wbId, stroke("s2"))).ok).toBe(true);
    got = waitFor(B, "wb:cleared");
    expect(await emit(A, "wb:clear", wbId)).toEqual({ ok: true, data: null });
    await got;
  });

  test("5001st stroke → board_full", async () => {
    const { wbId, A, alice } = await setup();
    const seeded = Array.from({ length: 5000 }, (_, i) => ({
      id: `seed-${i}`,
      userId: String(alice._id),
      color: "#000000",
      width: 1,
      points: [0, 0, 1, 1],
      createdAt: new Date(),
    }));
    await Whiteboard.updateOne({ _id: wbId }, { $set: { strokes: seeded } });
    expect(await emit(A, "wb:stroke", wbId, stroke("one-too-many"))).toEqual({ ok: false, error: "board_full" });
    const doc = await Whiteboard.findById(wbId).select("+strokes").lean();
    expect((doc as any).strokes).toHaveLength(5000);
  });

  test("resending a stroke with the same id does not duplicate it", async () => {
    const { wbId, A } = await setup();
    expect((await emit(A, "wb:stroke", wbId, stroke("dup"))).ok).toBe(true);
    expect((await emit(A, "wb:stroke", wbId, stroke("dup"))).ok).toBe(true);
    expect((await emit(A, "wb:open", wbId)).data.strokes).toHaveLength(1);
  });

  test("wb:drawing reaches B and is not persisted", async () => {
    const { wbId, A, B, C } = await setup();
    const outsider = expectNoEvent(C, "wb:drawing");
    const echo = expectNoEvent(A, "wb:drawing");
    const got = waitFor(B, "wb:drawing");
    A.emit("wb:drawing", wbId, { strokeId: "live-1", color: "#ff0000", width: 5, points: [0.1, 0.2, 0.3, 0.4] });
    const ev = await got;
    expect(ev).toMatchObject({ whiteboardId: wbId, strokeId: "live-1", color: "#ff0000", width: 5, points: [0.1, 0.2, 0.3, 0.4] });
    expect(typeof ev.userId).toBe("string");
    await Promise.all([outsider, echo]);
    expect((await emit(B, "wb:open", wbId)).data.strokes).toEqual([]);
    // Not relayed from a socket outside the board's room.
    const none = expectNoEvent(B, "wb:drawing");
    C.emit("wb:drawing", wbId, { strokeId: "x", color: "#ff0000", width: 5, points: [0, 0] });
    await none;
  });
});
