import Task from "../../src/models/workspaces/Task";
import Workspace from "../../src/models/workspaces/Workspace";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db";
import { makeChat, makeUser } from "../helpers/fixtures";
import { quietLogs, registerAll } from "../helpers/registerAll";
import { connectAs, emitAck, startTestServer, waitFor } from "../helpers/socketHarness";

describe("task socket events", () => {
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
    return { A, B, C, wsId };
  };

  const itemEvent = (action: string) => (p: any) => p.kind === "task" && p.action === action;

  it("create, update, move and delete are broadcast to joined members", async () => {
    const { A, B, wsId } = await setup();

    let next = waitFor(B, "workspace:item", itemEvent("created"));
    const created = await emitAck(A, "task:create", wsId, { title: "Write spec" });
    expect(created.ok).toBe(true);
    const taskId = created.ok ? String(created.data._id) : "";
    expect((await next).item.title).toBe("Write spec");

    next = waitFor(B, "workspace:item", (p) => itemEvent("updated")(p) && p.item.title === "Write v2");
    expect((await emitAck(A, "task:update", taskId, { title: "Write v2" })).ok).toBe(true);
    await next;

    next = waitFor(B, "workspace:item", (p) => itemEvent("updated")(p) && p.item.status === "inProgress");
    expect((await emitAck(A, "task:move", taskId, "inProgress", 500)).ok).toBe(true);
    expect((await next).item.order).toBe(500);

    next = waitFor(B, "workspace:item", itemEvent("deleted"));
    expect(await emitAck(B, "task:delete", taskId)).toEqual({ ok: true, data: null });
    expect(String((await next).item._id)).toBe(taskId);
  });

  it("outsider task:delete → forbidden and task still exists", async () => {
    const { A, C, wsId } = await setup();
    const created = await emitAck(A, "task:create", wsId, { title: "Keep me" });
    const taskId = created.ok ? String(created.data._id) : "";
    expect(await emitAck(C, "task:delete", taskId)).toEqual({ ok: false, error: "forbidden" });
    expect(await Task.exists({ _id: taskId })).toBeTruthy();
  });

  it("garbage input is rejected without crashing", async () => {
    const { A, wsId } = await setup();
    expect(await emitAck(A, "task:create", wsId)).toEqual({ ok: false, error: "invalid" });
    expect(await emitAck(A, "task:move", "nope", "done", 1)).toEqual({ ok: false, error: "not_found" });
    expect(await emitAck(A, "task:update", { evil: true }, {})).toEqual({ ok: false, error: "not_found" });
  });
});
