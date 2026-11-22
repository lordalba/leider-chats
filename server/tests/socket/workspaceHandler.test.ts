import { Socket as ClientSocket } from "socket.io-client";
import { startTestServer, connectAs } from "../helpers/socketHarness";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser, makeChat } from "../helpers/fixtures";
import workspaceHandler from "../../src/socketHandlers/workspaces/workspaceHandler";
import chatRoomHandler from "../../src/socketHandlers/chatRoomHandler";
import connectionHandler from "../../src/socketHandlers/connectionHandler";
import { WorkspacePresenceService } from "../../src/services/workspaces/WorkspacePresenceService";
import Workspace from "../../src/models/workspaces/Workspace";
import ChatRoom from "../../src/models/chatrooms/ChatRoom";
import User from "../../src/models/User";

let server: Awaited<ReturnType<typeof startTestServer>>;
let clients: ClientSocket[] = [];
// Focus ids must be ObjectId strings.
const FOCUS_ID = "507f1f77bcf86cd799439011";

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

/**
 * Holds the next User.findById (the one workspace:join does after its
 * membership check) until release() is called. `reached` resolves once the
 * join handler is parked there; release() resolves with the query result.
 */
function holdNextUserLookup() {
  const original = User.findById.bind(User);
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  let markReached!: () => void;
  const reached = new Promise<void>((r) => (markReached = r));
  let result: Promise<unknown> | undefined;
  const spy = jest.spyOn(User, "findById").mockImplementationOnce(((id: unknown) => {
    markReached();
    return {
      select: (fields: string) =>
        (result = gate.then(() => (original as any)(id).select(fields).exec())),
    };
  }) as any);
  return {
    reached,
    release: async () => {
      open();
      await result;
      // let the handler's continuation (synchronous up to its next await) run
      await new Promise((r) => setImmediate(r));
    },
    restore: () => spy.mockRestore(),
  };
}

async function waitForWorkspaceCount(n: number) {
  for (let i = 0; i < 80 && (await Workspace.countDocuments()) !== n; i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
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
  await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: FOCUS_ID });
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
  expect(await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: FOCUS_ID })).toEqual({ ok: true, data: null });
  const p = await focused;
  const a = p.members.find((m: any) => m.userId === String(alice._id));
  expect(a.focus).toEqual({ kind: "task", id: FOCUS_ID });
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

  // B really left ws:<id>: A's focus broadcast must not reach B.
  const none = expectNoEvent(B, "workspace:presence");
  await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: FOCUS_ID });
  await none;
});

test("eviction race: B evicted while its join is in flight → join acks forbidden, B not in room or presence", async () => {
  const { bob, chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);

  const hold = holdNextUserLookup();
  try {
    const joinAck = B.emitWithAck("workspace:join", wsId);
    await hold.reached; // B passed the membership check, parked before joining

    const revoked = waitFor(B, "workspace:revoked");
    A.emit("removeParticipantFromChat", chatId, String(bob._id), "bob", "alice");
    await revoked; // eviction has completed

    await hold.release();
    expect(await joinAck).toEqual({ ok: false, error: "forbidden" });
  } finally {
    hold.restore();
  }

  expect(WorkspacePresenceService.members(wsId).map((m) => m.userId)).not.toContain(String(bob._id));
  const none = expectNoEvent(B, "workspace:presence");
  const aSees = waitFor(A, "workspace:presence");
  await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: FOCUS_ID });
  expect((await aSees).members).toHaveLength(1);
  await none;
});

test("disconnect race: B disconnects while its join is in flight → no ghost presence entry", async () => {
  const { alice, chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);

  const hold = holdNextUserLookup();
  try {
    B.emit("workspace:join", wsId, () => {});
    await hold.reached;

    const serverSocket = server.io.sockets.sockets.get(B.id!);
    expect(serverSocket).toBeDefined();
    const disconnected = new Promise<void>((r) => serverSocket!.once("disconnect", () => r()));
    B.close();
    await disconnected; // connectionHandler's removeSocket has already run

    await hold.release();
  } finally {
    hold.restore();
  }

  expect(WorkspacePresenceService.members(wsId).map((m) => m.userId)).toEqual([String(alice._id)]);
  const aSees = waitFor(A, "workspace:presence");
  await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: FOCUS_ID });
  expect((await aSees).members.map((m: any) => m.userId)).toEqual([String(alice._id)]);
});

test("exitRoom by a member → that member gets workspace:revoked; workspace survives", async () => {
  const { bob, chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  await B.emitWithAck("workspace:join", wsId);

  const revoked = waitFor(B, "workspace:revoked");
  const aSeesOne = waitFor(A, "workspace:presence", (p: any) => p.members.length === 1);
  B.emit("exitRoom", chatId, String(bob._id), "bob");
  expect(await revoked).toEqual({ workspaceId: wsId });
  await aSeesOne;

  expect(await B.emitWithAck("workspace:focus", wsId, null)).toEqual({ ok: false, error: "forbidden" });
  expect(await Workspace.countDocuments()).toBe(1);
});

test("exitRoom by the last member → chat and its workspaces are deleted", async () => {
  const solo = await makeUser("solo");
  const chat = await makeChat([solo], [solo]);
  const chatId = String(chat._id);
  const S = await connect(String(solo._id));
  const wsId = await makeWorkspace(S, chatId);
  await S.emitWithAck("workspace:join", wsId);

  const revoked = waitFor(S, "workspace:revoked");
  S.emit("exitRoom", chatId, String(solo._id), "solo");
  expect(await revoked).toEqual({ workspaceId: wsId });

  await waitForWorkspaceCount(0);
  expect(await Workspace.countDocuments()).toBe(0);
  expect(await ChatRoom.exists({ _id: chat._id })).toBeNull();
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

test("focus id must be a 24-hex ObjectId string, otherwise invalid", async () => {
  const { chatId, A } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  for (const id of ["t1", "", "zzzzzzzzzzzzzzzzzzzzzzzz", "507f1f77bcf86cd79943901", 42]) {
    expect(await A.emitWithAck("workspace:focus", wsId, { kind: "task", id })).toEqual({
      ok: false,
      error: "invalid",
    });
  }
  expect(await A.emitWithAck("workspace:focus", wsId, { kind: "task", id: FOCUS_ID })).toEqual({
    ok: true,
    data: null,
  });
});

test("leave by a socket that never joined acks ok and members receive no presence event", async () => {
  const { chatId, A, B } = await setup();
  const wsId = await makeWorkspace(A, chatId);
  await A.emitWithAck("workspace:join", wsId);
  const none = expectNoEvent(A, "workspace:presence");
  expect(await B.emitWithAck("workspace:leave", wsId)).toEqual({ ok: true, data: null });
  await none;
  expect(WorkspacePresenceService.members(wsId)).toHaveLength(1);
});

describe("legacy chat events are gated by the authenticated user", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  async function waitForWarn() {
    for (let i = 0; i < 80 && warn.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(warn).toHaveBeenCalled();
  }

  test("non-admin deleteRoom: chat and its workspaces still exist", async () => {
    const { bob, chat, chatId, A, B } = await setup();
    const wsId = await makeWorkspace(A, chatId);
    await A.emitWithAck("workspace:join", wsId);

    const noRevoke = expectNoEvent(A, "workspace:revoked");
    B.emit("deleteRoom", chatId, String(bob._id));
    await waitForWarn();
    await noRevoke;

    expect(await ChatRoom.exists({ _id: chat._id })).not.toBeNull();
    expect(await Workspace.countDocuments()).toBe(1);
  });

  test("unauthenticated removeParticipantFromChat: no eviction", async () => {
    const { bob, chat, chatId, A, B } = await setup();
    const wsId = await makeWorkspace(A, chatId);
    await B.emitWithAck("workspace:join", wsId);

    const anon = await connectAs(server.url, null);
    clients.push(anon);
    const noRevoke = expectNoEvent(B, "workspace:revoked");
    anon.emit("removeParticipantFromChat", chatId, String(bob._id), "bob", "mallory");
    await waitForWarn();
    await noRevoke;

    const fresh = await ChatRoom.findById(chat._id);
    expect(fresh!.participants.map(String)).toContain(String(bob._id));
    expect(await B.emitWithAck("workspace:focus", wsId, null)).toEqual({ ok: true, data: null });
  });

  test("exitRoom with someone else's userId: no change", async () => {
    const { bob, chat, chatId, A, B } = await setup();
    const wsId = await makeWorkspace(A, chatId);
    await B.emitWithAck("workspace:join", wsId);

    const noRevoke = expectNoEvent(B, "workspace:revoked");
    A.emit("exitRoom", chatId, String(bob._id), "bob");
    await waitForWarn();
    await noRevoke;

    const fresh = await ChatRoom.findById(chat._id);
    expect(fresh!.participants.map(String)).toContain(String(bob._id));
    expect(await Workspace.countDocuments()).toBe(1);
  });
});
