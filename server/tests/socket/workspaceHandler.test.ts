import Workspace from "../../src/models/workspaces/Workspace";
import { WorkspacePresenceService } from "../../src/services/workspaces/WorkspacePresenceService";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db";
import { makeChat, makeUser } from "../helpers/fixtures";
import { quietLogs, registerAll } from "../helpers/registerAll";
import { ClientSocket, connectAs, delay, emitAck, record, startTestServer, waitFor } from "../helpers/socketHarness";

describe("workspace socket events", () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let restoreLogs: () => void;

  beforeAll(async () => {
    restoreLogs = quietLogs();
    await connectTestDb();
    server = await startTestServer(registerAll);
  });
  afterEach(async () => {
    WorkspacePresenceService.reset();
    await clearTestDb();
  });
  afterAll(async () => {
    await server.close();
    await disconnectTestDb();
    restoreLogs();
  });

  const online = async (userId: string): Promise<ClientSocket> => {
    const client = await connectAs(server.url, userId);
    client.emit("userOnline", userId);
    return client;
  };

  const setup = async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");
    const carol = await makeUser("carol");
    const chat = await makeChat([alice, bob], [alice]);
    const A = await online(String(alice._id));
    const B = await online(String(bob._id));
    const C = await online(String(carol._id));
    await delay(50);
    return { alice, bob, carol, chat, A, B, C, chatId: String(chat._id) };
  };

  const createWs = async (client: ClientSocket, chatId: string) => {
    const res = await emitAck(client, "workspace:create", chatId, { name: "Plan" });
    if (!res.ok) throw new Error(res.error);
    return String(res.data._id);
  };

  it("A creates workspace → B receives chat:workspaces-changed and newMessage in the chat room", async () => {
    const { bob, A, B, chatId } = await setup();
    B.emit("joinRoom", null, chatId, String(bob._id));
    await delay(100);

    const changed = waitFor(B, "chat:workspaces-changed", (p) => p.chatRoomId === chatId);
    const message = waitFor(B, "newMessage");
    const res = await emitAck(A, "workspace:create", chatId, { name: "Plan" });
    expect(res.ok).toBe(true);
    await changed;
    expect((await message).content).toBe('alice created the workspace "Plan"');
  });

  it("A and B join → both receive presence with 2 members", async () => {
    const { A, B, chatId } = await setup();
    const wsId = await createWs(A, chatId);

    const joinA = await emitAck(A, "workspace:join", wsId);
    expect(joinA.ok && joinA.data.members).toHaveLength(1);

    const aSeesTwo = waitFor(A, "workspace:presence", (p) => p.members.length === 2);
    const joinB = await emitAck(B, "workspace:join", wsId);
    expect(joinB.ok && joinB.data.members).toHaveLength(2);
    await aSeesTwo;
  });

  it("C join → forbidden and C receives no presence events", async () => {
    const { A, C, chatId } = await setup();
    const wsId = await createWs(A, chatId);
    const seen = record(C, "workspace:presence");
    expect(await emitAck(C, "workspace:join", wsId)).toEqual({ ok: false, error: "forbidden" });
    await emitAck(A, "workspace:join", wsId);
    await delay(100);
    expect(seen).toHaveLength(0);
  });

  it("garbage workspace id → not_found", async () => {
    const { A } = await setup();
    expect(await emitAck(A, "workspace:join", "abc")).toEqual({ ok: false, error: "not_found" });
    expect(await emitAck(A, "workspace:join", { $gt: "" })).toEqual({ ok: false, error: "not_found" });
    expect(await emitAck(A, "workspace:create", "abc", { name: "x" })).toEqual({ ok: false, error: "not_found" });
  });

  it('A focus {kind:"task", id} → B\'s presence shows A\'s focus', async () => {
    const { alice, A, B, chatId } = await setup();
    const wsId = await createWs(A, chatId);
    await emitAck(A, "workspace:join", wsId);
    await emitAck(B, "workspace:join", wsId);

    const focused = waitFor(B, "workspace:presence", (p) =>
      p.members.some((m: any) => m.userId === String(alice._id) && m.focus && m.focus.id === "t1")
    );
    expect((await emitAck(A, "workspace:focus", wsId, { kind: "task", id: "t1" })).ok).toBe(true);
    await focused;
    expect(await emitAck(A, "workspace:focus", wsId, { kind: "bogus", id: "x" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("A disconnects → B receives presence with 1 member", async () => {
    const { A, B, chatId } = await setup();
    const wsId = await createWs(A, chatId);
    await emitAck(A, "workspace:join", wsId);
    await emitAck(B, "workspace:join", wsId);

    const down = waitFor(B, "workspace:presence", (p) => p.members.length === 1);
    A.disconnect();
    await down;
  });

  it("Review Focus 1: B removed from chat → B receives workspace:revoked, next write is forbidden", async () => {
    const { alice, bob, A, B, chatId } = await setup();
    const wsId = await createWs(A, chatId);
    await emitAck(A, "workspace:join", wsId);
    await emitAck(B, "workspace:join", wsId);

    const revoked = waitFor(B, "workspace:revoked", (p) => p.workspaceId === wsId);
    const aSeesOne = waitFor(A, "workspace:presence", (p) => p.members.length === 1);
    A.emit("removeParticipantFromChat", chatId, String(bob._id), "bob", "alice");
    await revoked;
    await aSeesOne;

    expect(await emitAck(B, "workspace:focus", wsId, null)).toEqual({ ok: false, error: "forbidden" });
    expect(await emitAck(B, "task:create", wsId, { title: "sneaky" })).toEqual({ ok: false, error: "forbidden" });
    // A is unaffected.
    expect((await emitAck(A, "workspace:focus", wsId, null)).ok).toBe(true);
    expect(String(alice._id)).toBeTruthy();
  });

  it("deleteRoom → workspaces of that chat are deleted and joined sockets get workspace:revoked", async () => {
    const { alice, A, B, chatId } = await setup();
    const wsId = await createWs(A, chatId);
    await emitAck(B, "workspace:join", wsId);

    const revoked = waitFor(B, "workspace:revoked", (p) => p.workspaceId === wsId);
    A.emit("deleteRoom", chatId, String(alice._id));
    await revoked;
    expect(await Workspace.countDocuments()).toBe(0);
  });

  it("workspace:delete by a non-admin non-creator → forbidden; by creator → members get revoked", async () => {
    const { A, B, chatId } = await setup();
    const wsId = await createWs(A, chatId);
    await emitAck(B, "workspace:join", wsId);

    expect(await emitAck(B, "workspace:delete", wsId)).toEqual({ ok: false, error: "forbidden" });
    const revoked = waitFor(B, "workspace:revoked", (p) => p.workspaceId === wsId);
    expect(await emitAck(A, "workspace:delete", wsId)).toEqual({ ok: true, data: null });
    await revoked;
  });

  it("workspace:rename broadcasts workspace:updated", async () => {
    const { A, B, chatId } = await setup();
    const wsId = await createWs(A, chatId);
    await emitAck(B, "workspace:join", wsId);
    const updated = waitFor(B, "workspace:updated", (p) => p.name === "Renamed");
    expect((await emitAck(A, "workspace:rename", wsId, { name: "Renamed" })).ok).toBe(true);
    await updated;
  });
});
