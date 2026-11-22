import { Socket as ClientSocket } from "socket.io-client";
import { startTestServer, connectAs } from "../helpers/socketHarness";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser, makeChat } from "../helpers/fixtures";
import chatRoomHandler from "../../src/socketHandlers/chatRoomHandler";
import messageHandler from "../../src/socketHandlers/messageHandler";
import connectionHandler from "../../src/socketHandlers/connectionHandler";
import ChatRoom from "../../src/models/chatrooms/ChatRoom";
import Message from "../../src/models/chatrooms/Message";

let server: Awaited<ReturnType<typeof startTestServer>>;
let clients: ClientSocket[] = [];
let warnSpy: jest.SpyInstance;

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  await connectTestDb();
  server = await startTestServer((io, socket) => {
    connectionHandler(io, socket);
    chatRoomHandler(io, socket);
    messageHandler(io, socket);
  });
});

afterEach(async () => {
  const closing = clients.splice(0);
  closing.forEach((c) => c.close());
  await new Promise((r) => setTimeout(r, 50));
  await clearTestDb();
  warnSpy.mockClear();
});

afterAll(async () => {
  await server.close();
  await disconnectTestDb();
  jest.restoreAllMocks();
});

function waitFor<T = any>(socket: ClientSocket, event: string, timeout = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);
    const handler = (data: T) => {
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

const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));

async function connect(userId: string | null): Promise<ClientSocket> {
  const c = await connectAs(server.url, userId);
  clients.push(c);
  return c;
}

async function setup() {
  const a = await makeUser("adminA");
  const b = await makeUser("memberB");
  const c = await makeUser("outsiderC");
  const chat = await makeChat([a, b], [a]);
  const id = String(chat._id);
  return { id, aId: String(a._id), bId: String(b._id), cId: String(c._id) };
}

describe("legacy chat socket event authorization", () => {
  it("refuses updateUserAdminStatus from a non-admin member", async () => {
    const s = await setup();
    const sb = await connect(s.bId);
    sb.emit("updateUserAdminStatus", s.id, s.bId, true);
    await settle();
    const chat = await ChatRoom.findById(s.id);
    expect(chat!.admins.map(String)).toEqual([s.aId]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("lets an admin promote a participant and notifies online participants", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    const sb = await connect(s.bId);
    sb.emit("userOnline", s.bId);
    await settle();
    const got = waitFor(sb, "update-user-chat-admin");
    sa.emit("updateUserAdminStatus", s.id, s.bId, true);
    expect(await got).toMatchObject({ userId: s.bId, updateToAdmin: true });
    await settle();
    const chat = await ChatRoom.findById(s.id);
    expect(chat!.admins.map(String)).toContain(s.bId);
  });

  it("refuses promoting a non-participant", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    sa.emit("updateUserAdminStatus", s.id, s.cId, true);
    await settle();
    const chat = await ChatRoom.findById(s.id);
    expect(chat!.admins.map(String)).toEqual([s.aId]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("refuses updateAdminPermissions from a member, allows it for an admin", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    const sb = await connect(s.bId);
    sb.emit("updateAdminPermissions", s.id, true);
    await settle();
    expect((await ChatRoom.findById(s.id))!.adminPermissions).toBeFalsy();
    sa.emit("updateAdminPermissions", s.id, true);
    await settle();
    expect((await ChatRoom.findById(s.id))!.adminPermissions).toBe(true);
  });

  it("refuses updateAdminPermissions with a non-boolean value", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    sa.emit("updateAdminPermissions", s.id, "yes");
    await settle();
    expect((await ChatRoom.findById(s.id))!.adminPermissions).toBeFalsy();
  });

  it("refuses joinRoom for an outsider (no newMessage delivered)", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    const sc = await connect(s.cId);
    sc.emit("joinRoom", null, s.id, s.cId);
    await settle();
    sa.emit("joinRoom", null, s.id, s.aId);
    await settle();
    const none = expectNoEvent(sc, "newMessage");
    sa.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "hi", type: "text" });
    await none;
  });

  it("refuses joinRoom with a spoofed userId", async () => {
    const s = await setup();
    const sb = await connect(s.bId);
    const sa = await connect(s.aId);
    sb.emit("joinRoom", null, s.id, s.aId);
    await settle();
    sa.emit("joinRoom", null, s.id, s.aId);
    await settle();
    const none = expectNoEvent(sb, "newMessage");
    sa.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "hi", type: "text" });
    await none;
  });

  it("refuses sendMessage with a spoofed senderId", async () => {
    const s = await setup();
    const sb = await connect(s.bId);
    sb.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "hi", type: "text" });
    await settle();
    expect(await Message.countDocuments()).toBe(0);
  });

  it("refuses sendMessage from an outsider", async () => {
    const s = await setup();
    const sc = await connect(s.cId);
    sc.emit("sendMessage", { chatRoomId: s.id, senderId: s.cId, content: "hi", type: "text" });
    await settle();
    expect(await Message.countDocuments()).toBe(0);
  });

  it("allows a participant to send and broadcasts to the room", async () => {
    const s = await setup();
    const sb = await connect(s.bId);
    sb.emit("joinRoom", null, s.id, s.bId);
    await settle();
    const got = waitFor(sb, "newMessage");
    sb.emit("sendMessage", { chatRoomId: s.id, senderId: s.bId, content: "hello", type: "text" });
    expect((await got).content).toBe("hello");
    expect(await Message.countDocuments()).toBe(1);
  });

  it("with adminPermissions on, only admins can send", async () => {
    const s = await setup();
    await ChatRoom.findByIdAndUpdate(s.id, { adminPermissions: true });
    const sa = await connect(s.aId);
    const sb = await connect(s.bId);
    sb.emit("sendMessage", { chatRoomId: s.id, senderId: s.bId, content: "nope", type: "text" });
    await settle();
    expect(await Message.countDocuments()).toBe(0);
    sa.emit("joinRoom", null, s.id, s.aId);
    await settle();
    const got = waitFor(sa, "newMessage");
    sa.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "ok", type: "text" });
    expect((await got).content).toBe("ok");
    expect(await Message.countDocuments()).toBe(1);
  });

  it("refuses typing with a spoofed userId, allows own", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    const sb = await connect(s.bId);
    sa.emit("joinRoom", null, s.id, s.aId);
    await settle();
    const none = expectNoEvent(sa, "friendTyping");
    sb.emit("typing", { chatroomId: s.id, userId: s.aId, username: "x" });
    await none;
    const got = waitFor(sa, "friendTyping");
    sa.emit("typing", { chatroomId: s.id, userId: s.aId, username: "adminA" });
    expect(await got).toMatchObject({ userId: s.aId });
  });

  it("refuses events from an unauthenticated socket", async () => {
    const s = await setup();
    const anon = await connect(null);
    anon.emit("updateUserAdminStatus", s.id, s.bId, true);
    await settle();
    const chat = await ChatRoom.findById(s.id);
    expect(chat!.admins.map(String)).toEqual([s.aId]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("phase 2 review fixes", () => {
  it("emits auth:expired (once) when an unauthenticated socket sends a chat event", async () => {
    const s = await setup();
    const anon = await connect(null);
    let count = 0;
    anon.on("auth:expired", () => count++);
    const got = waitFor(anon, "auth:expired");
    anon.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "hi", type: "text" });
    await got;
    anon.emit("joinRoom", null, s.id, s.aId);
    anon.emit("typing", { chatroomId: s.id, userId: s.aId, username: "x" });
    await settle();
    expect(count).toBe(1);
    expect(await Message.countDocuments()).toBe(0);
  });

  it("does not emit auth:expired for refusals of an authenticated socket", async () => {
    const s = await setup();
    const sc = await connect(s.cId);
    const none = expectNoEvent(sc, "auth:expired");
    sc.emit("sendMessage", { chatRoomId: s.id, senderId: s.cId, content: "hi", type: "text" });
    await none;
  });

  it("userOnline ignores a payload userId that is not the authenticated user", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    const sb = await connect(s.bId);
    const sc = await connect(s.cId);
    sa.emit("userOnline", s.aId);
    sc.emit("userOnline", s.aId);
    await settle();
    sb.emit("joinRoom", null, s.id, s.bId);
    await settle();
    const none = expectNoEvent(sc, "newChatMessage", 500);
    const got = waitFor(sa, "newChatMessage");
    sb.emit("sendMessage", { chatRoomId: s.id, senderId: s.bId, content: "hi", type: "text" });
    expect(await got).toMatchObject({ chatRoomId: s.id });
    await none;
  });

  it("removed participant's sockets stop receiving the chat's room broadcasts", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    const sb1 = await connect(s.bId);
    const sb2 = await connect(s.bId);
    for (const [sock, id] of [[sa, s.aId], [sb1, s.bId], [sb2, s.bId]] as const) {
      sock.emit("joinRoom", null, s.id, id);
    }
    await settle();
    sa.emit("removeParticipantFromChat", s.id, s.bId, "memberB", "adminA");
    await settle(400);
    expect((await ChatRoom.findById(s.id))!.participants.map(String)).toEqual([s.aId]);
    const none1 = expectNoEvent(sb1, "newMessage");
    const none2 = expectNoEvent(sb2, "newMessage");
    const got = waitFor(sa, "newMessage");
    sa.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "after", type: "text" });
    expect((await got).content).toBe("after");
    await Promise.all([none1, none2]);
  });

  it("exitRoom makes the leaver's other tabs leave the chat room", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    const sb1 = await connect(s.bId);
    const sb2 = await connect(s.bId);
    for (const [sock, id] of [[sa, s.aId], [sb1, s.bId], [sb2, s.bId]] as const) {
      sock.emit("joinRoom", null, s.id, id);
    }
    await settle();
    sb1.emit("exitRoom", s.id, s.bId, "memberB");
    await settle(400);
    const none = expectNoEvent(sb2, "newMessage");
    const got = waitFor(sa, "newMessage");
    sa.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "after", type: "text" });
    expect((await got).content).toBe("after");
    await none;
  });

  it("refuses client-sent system messages", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    sa.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "forged", type: "system" });
    sa.emit("sendMessage", { chatRoomId: s.id, senderId: s.aId, content: "x", type: "bogus" });
    await settle();
    expect(await Message.countDocuments()).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("refuses a non-boolean updateToAdmin", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    sa.emit("updateUserAdminStatus", s.id, s.bId, "true");
    await settle();
    expect((await ChatRoom.findById(s.id))!.admins.map(String)).toEqual([s.aId]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("promoting an existing admin does not duplicate it", async () => {
    const s = await setup();
    const sa = await connect(s.aId);
    sa.emit("updateUserAdminStatus", s.id, s.aId, true);
    await settle();
    expect((await ChatRoom.findById(s.id))!.admins.map(String)).toEqual([s.aId]);
  });
});
