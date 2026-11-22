import { Socket as ClientSocket } from "socket.io-client";
import { startTestServer, connectAs } from "../helpers/socketHarness";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser, makeChat } from "../helpers/fixtures";
import workspaceHandler from "../../src/socketHandlers/workspaces/workspaceHandler";
import chatRoomHandler from "../../src/socketHandlers/chatRoomHandler";
import connectionHandler from "../../src/socketHandlers/connectionHandler";
import { WorkspacePresenceService } from "../../src/services/workspaces/WorkspacePresenceService";
import Workspace from "../../src/models/workspaces/Workspace";

let server: Awaited<ReturnType<typeof startTestServer>>;
let clients: ClientSocket[] = [];

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  await connectTestDb();
  server = await startTestServer((io, socket) => {
    connectionHandler(io, socket);
    chatRoomHandler(io, socket);
    workspaceHandler(io, socket);
  });
});

beforeEach(() => WorkspacePresenceService.reset());

afterEach(async () => {
  const closing = clients.splice(0);
  closing.forEach((c) => c.close());
  // let server-side disconnect handlers settle before the db is cleared
  await new Promise((r) => setTimeout(r, 50));
  await clearTestDb();
});

afterAll(async () => {
  await server.close();
  await disconnectTestDb();
  jest.restoreAllMocks();
});

function waitFor<T = any>(
  socket: ClientSocket,
  event: string,
  predicate: (data: T) => boolean = () => true,
  timeout = 2000
): Promise<T> {
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
    const handler = (data: unknown) => {
      clearTimeout(timer);
      socket.off(event, handler);
      reject(new Error(`unexpected ${event}: ${JSON.stringify(data)}`));
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
    socket.on(event, handler);
  });
}

async function connect(userId: string): Promise<ClientSocket> {
  const c = await connectAs(server.url, userId);
  clients.push(c);
  return c;
}

async function setup() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const carol = await makeUser("carol");
  const chat = await makeChat([alice, bob], [alice]);
  const A = await connect(String(alice._id));
  const B = await connect(String(bob._id));
  const C = await connect(String(carol._id));
  return { alice, bob, carol, chat, chatId: String(chat._id), A, B, C };
}

async function makeWorkspace(A: ClientSocket, chatId: string): Promise<string> {
  const res = await A.emitWithAck("workspace:create", chatId, { name: "Plans" });
  expect(res.ok).toBe(true);
  return String(res.data._id);
}

test("A creates workspace → B (online) receives chat:workspaces-changed and newMessage in the chat room", async () => {
  const { bob, chatId, A, B } = await setup();
  B.emit("userOnline", String(bob._id));
  const joined = waitFor(B, "messagesMarkedAsRead");
  B.emit("joinRoom", null, chatId, String(bob._id));
  await joined;

  const changed = waitFor(B, "chat:workspaces-changed");
  const msg = waitFor(B, "newMessage");
  const res = await A.emitWithAck("workspace:create", chatId, { name: "Plans" });
  expect(res.ok).toBe(true);
  expect(res.data.name).toBe("Plans");
  expect(await changed).toEqual({ chatRoomId: chatId });
  const m = await msg;
  expect(m.content).toBe('alice created the workspace "Plans"');
  expect(m.type).toBe("system");
});

test("create with invalid name acks invalid; non-ObjectId chat acks not_found", async () => {
  const { chatId, A } = await setup();
  expect(await A.emitWithAck("workspace:create", chatId, { name: "  " })).toEqual({ ok: false, error: "invalid" });
  expect(await A.emitWithAck("workspace:create", "bad", { name: "x" })).toEqual({ ok: false, error: "not_found" });
});

test("A and B join → both receive presence with 2 members", async () => {
  const { chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);

  const aJoin = await A.emitWithAck("workspace:join", wsId);
  expect(aJoin.ok).toBe(true);
  expect(aJoin.data.members).toHaveLength(1);

  const aSees = waitFor(A, "workspace:presence", (p: any) => p.members.length === 2);
  const bSees = waitFor(B, "workspace:presence", (p: any) => p.members.length === 2);
  const bJoin = await B.emitWithAck("workspace:join", wsId);
  expect(bJoin.ok).toBe(true);
  expect(bJoin.data.members).toHaveLength(2);

  const pa = await aSees;
  await bSees;
  expect(pa.workspaceId).toBe(wsId);
  expect(pa.members.map((m: any) => m.username).sort()).toEqual(["alice", "bob"]);
});

test("C join → forbidden and C receives no presence events", async () => {
  const { chatId, A, C } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  expect(await C.emitWithAck("workspace:join", wsId)).toEqual({ ok: false, error: "forbidden" });
  const none = expectNoEvent(C, "workspace:presence");
  await A.emitWithAck("workspace:join", wsId);
  await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: "t1" });
  await none;
});

test('A focus {kind:"task",id} → B\'s presence shows A\'s focus', async () => {
  const { alice, chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  await B.emitWithAck("workspace:join", wsId);

  const focused = waitFor(B, "workspace:presence", (p: any) =>
    p.members.some((m: any) => m.userId === String(alice._id) && m.focus)
  );
  expect(await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: "t1" })).toEqual({ ok: true, data: null });
  const p = await focused;
  const a = p.members.find((m: any) => m.userId === String(alice._id));
  expect(a.focus).toEqual({ kind: "task", id: "t1" });
});

test("A disconnects → B receives presence with 1 member", async () => {
  const { bob, chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  await B.emitWithAck("workspace:join", wsId);

  const after = waitFor(B, "workspace:presence", (p: any) => p.members.length === 1);
  A.close();
  const p = await after;
  expect(p.members[0].userId).toBe(String(bob._id));
});

test("A leave → B receives presence with 1 member", async () => {
  const { chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  await B.emitWithAck("workspace:join", wsId);
  const after = waitFor(B, "workspace:presence", (p: any) => p.members.length === 1);
  expect(await A.emitWithAck("workspace:leave", wsId)).toEqual({ ok: true, data: null });
  await after;
});

test("rename broadcasts workspace:updated to ws room", async () => {
  const { chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await B.emitWithAck("workspace:join", wsId);
  const updated = waitFor(B, "workspace:updated");
  const res = await A.emitWithAck("workspace:rename", wsId, { name: "Renamed" });
  expect(res.ok).toBe(true);
  expect(res.data.name).toBe("Renamed");
  expect((await updated).name).toBe("Renamed");
});

test("delete by non-creator non-admin forbidden; by creator revokes ws room", async () => {
  const { chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await B.emitWithAck("workspace:join", wsId);
  expect(await B.emitWithAck("workspace:delete", wsId)).toEqual({ ok: false, error: "forbidden" });
  const revoked = waitFor(B, "workspace:revoked");
  expect(await A.emitWithAck("workspace:delete", wsId)).toEqual({ ok: true, data: null });
  expect(await revoked).toEqual({ workspaceId: wsId });
  expect(await Workspace.countDocuments()).toBe(0);
});

test("B removed from chat (emit removeParticipantFromChat) → B receives workspace:revoked, and B's next workspace:focus acks forbidden", async () => {
  const { bob, chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  await B.emitWithAck("workspace:join", wsId);

  const revoked = waitFor(B, "workspace:revoked");
  const aSeesOne = waitFor(A, "workspace:presence", (p: any) => p.members.length === 1);
  A.emit("removeParticipantFromChat", chatId, String(bob._id), "bob", "alice");
  expect(await revoked).toEqual({ workspaceId: wsId });
  await aSeesOne;

  expect(await B.emitWithAck("workspace:focus", wsId, { kind: "task", id: "x" })).toEqual({
    ok: false,
    error: "forbidden",
  });
});

test("deleteRoom → workspaces of that chat are deleted and joined sockets get workspace:revoked", async () => {
  const { alice, chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  await B.emitWithAck("workspace:join", wsId);

  const aRevoked = waitFor(A, "workspace:revoked");
  const bRevoked = waitFor(B, "workspace:revoked");
  A.emit("deleteRoom", chatId, String(alice._id));
  expect(await aRevoked).toEqual({ workspaceId: wsId });
  expect(await bRevoked).toEqual({ workspaceId: wsId });

  for (let i = 0; i < 40 && (await Workspace.countDocuments()) > 0; i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
  expect(await Workspace.countDocuments()).toBe(0);
});
