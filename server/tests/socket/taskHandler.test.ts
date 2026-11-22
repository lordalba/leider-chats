import { Socket as ClientSocket } from "socket.io-client";
import { startTestServer, connectAs } from "../helpers/socketHarness";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser, makeChat } from "../helpers/fixtures";
import workspaceHandler from "../../src/socketHandlers/workspaces/workspaceHandler";
import taskHandler from "../../src/socketHandlers/workspaces/taskHandler";
import connectionHandler from "../../src/socketHandlers/connectionHandler";
import { WorkspacePresenceService } from "../../src/services/workspaces/WorkspacePresenceService";
import Workspace from "../../src/models/workspaces/Workspace";
import Task from "../../src/models/workspaces/Task";

let server: Awaited<ReturnType<typeof startTestServer>>;
let clients: ClientSocket[] = [];

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  await connectTestDb();
  server = await startTestServer((io, socket) => {
    connectionHandler(io, socket);
    workspaceHandler(io, socket);
    taskHandler(io, socket);
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

const emit = (s: ClientSocket, ev: string, ...args: unknown[]): Promise<any> =>
  new Promise((r) => s.emit(ev, ...args, r));

async function connect(userId: string) {
  const c = await connectAs(server.url, userId);
  clients.push(c);
  return c;
}

async function setup() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const carol = await makeUser("carol");
  const chat = await makeChat([alice, bob], [alice]);
  const ws = await Workspace.create({ name: "W", chatRoomId: chat._id, createdBy: alice._id });
  const wsId = String(ws._id);
  const A = await connect(String(alice._id));
  const B = await connect(String(bob._id));
  const C = await connect(String(carol._id));
  expect((await emit(B, "workspace:join", wsId)).ok).toBe(true);
  return { wsId, A, B, C };
}

describe("taskHandler", () => {
  test("create/update/move/delete broadcast to joined members", async () => {
    const { wsId, A, B } = await setup();

    let p = waitFor(B, "workspace:item", (d) => d.action === "created");
    const created = await emit(A, "task:create", wsId, { title: "T" });
    expect(created.ok).toBe(true);
    let ev = await p;
    expect(ev).toMatchObject({ workspaceId: wsId, kind: "task", action: "created" });
    expect(ev.item._id).toBe(created.data._id);
    const id = created.data._id;

    p = waitFor(B, "workspace:item", (d) => d.action === "updated" && d.item.title === "T2");
    expect((await emit(A, "task:update", id, { title: "T2" })).ok).toBe(true);
    ev = await p;
    expect(ev).toMatchObject({ workspaceId: wsId, kind: "task" });

    p = waitFor(B, "workspace:item", (d) => d.action === "updated" && d.item.status === "done");
    const moved = await emit(A, "task:move", id, "done", 5);
    expect(moved.ok).toBe(true);
    await p;

    p = waitFor(B, "workspace:item", (d) => d.action === "deleted");
    expect(await emit(A, "task:delete", id)).toEqual({ ok: true, data: null });
    ev = await p;
    expect(ev).toMatchObject({ workspaceId: wsId, kind: "task", item: { _id: id } });
  });

  test("outsider task:delete -> forbidden and task remains", async () => {
    const { wsId, A, C } = await setup();
    const created = await emit(A, "task:create", wsId, { title: "T" });
    const res = await emit(C, "task:delete", created.data._id);
    expect(res).toEqual({ ok: false, error: "forbidden" });
    expect(await Task.findById(created.data._id)).not.toBeNull();
  });
});
