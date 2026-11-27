import * as Y from "yjs";
import { Socket as ClientSocket } from "socket.io-client";
import { startTestServer, connectAs } from "../helpers/socketHarness";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser, makeChat } from "../helpers/fixtures";
import workspaceHandler from "../../src/socketHandlers/workspaces/workspaceHandler";
import documentHandler from "../../src/socketHandlers/workspaces/documentHandler";
import connectionHandler from "../../src/socketHandlers/connectionHandler";
import { WorkspacePresenceService } from "../../src/services/workspaces/WorkspacePresenceService";
import { yDocManager } from "../../src/services/workspaces/YDocManager";
import Workspace from "../../src/models/workspaces/Workspace";
import DocumentModel from "../../src/models/workspaces/Document";
import ChatRoom from "../../src/models/chatrooms/ChatRoom";
import mongoose from "mongoose";
import { evictUserFromChatWorkspaces } from "../../src/services/workspaces/WorkspaceService";

let server: Awaited<ReturnType<typeof startTestServer>>;
let clients: ClientSocket[] = [];

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  await connectTestDb();
  server = await startTestServer((io, socket) => {
    connectionHandler(io, socket);
    workspaceHandler(io, socket);
    documentHandler(io, socket);
  });
});
beforeEach(() => WorkspacePresenceService.reset());
afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  await new Promise((r) => setTimeout(r, 100));
  await yDocManager.flushAll();
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

const bytes = (b: unknown) => new Uint8Array(b as ArrayBuffer);

/** A client-side Y.Doc wired to a socket like the real provider would be. */
async function openDoc(s: ClientSocket, docId: string) {
  const ydoc = new Y.Doc();
  const res = await emit(s, "doc:open", docId);
  expect(res.ok).toBe(true);
  Y.applyUpdate(ydoc, bytes(res.data.update), "remote");
  s.on("doc:update", (p: { docId: string; update: ArrayBuffer }) => {
    if (p.docId === docId) Y.applyUpdate(ydoc, bytes(p.update), "remote");
  });
  ydoc.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "remote") s.emit("doc:update", docId, u, () => {});
  });
  return ydoc;
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
  expect((await emit(A, "workspace:join", wsId)).ok).toBe(true);
  expect((await emit(B, "workspace:join", wsId)).ok).toBe(true);
  const created = await emit(A, "doc:create", wsId, "Notes");
  expect(created.ok).toBe(true);
  return { wsId, A, B, C, docId: String(created.data._id), created };
}

const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));

describe("documentHandler", () => {
  test("doc:create returns item meta and broadcasts workspace:item created", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");
    const chat = await makeChat([alice, bob], [alice]);
    const ws = await Workspace.create({ name: "W", chatRoomId: chat._id, createdBy: alice._id });
    const wsId = String(ws._id);
    const A = await connect(String(alice._id));
    const B = await connect(String(bob._id));
    await emit(B, "workspace:join", wsId);
    const p = waitFor(B, "workspace:item", (d) => d.kind === "document" && d.action === "created");
    const res = await emit(A, "doc:create", wsId, "  Spec  ");
    expect(res.ok).toBe(true);
    expect(Object.keys(res.data).sort()).toEqual(["_id", "title", "updatedAt"]);
    expect(res.data.title).toBe("Spec");
    expect((await p).item._id).toBe(res.data._id);
    expect(await emit(A, "doc:create", wsId, "   ")).toEqual({ ok: false, error: "invalid" });
    expect(await emit(A, "doc:create", wsId, "x".repeat(121))).toEqual({ ok: false, error: "invalid" });
  });

  test('A and B open; A sends an update inserting "hi" → B receives doc:update and, applied, B\'s Y.Text equals "hi"', async () => {
    const { A, B, docId } = await setup();
    const a = await openDoc(A, docId);
    const b = await openDoc(B, docId);
    const got = waitFor(B, "doc:update", (d) => d.docId === docId);
    a.getText("quill").insert(0, "hi");
    await got;
    await settle(50);
    expect(b.getText("quill").toString()).toBe("hi");
  });

  test("concurrent inserts at position 0 from A and B converge to the same string on both", async () => {
    const { A, B, docId } = await setup();
    const a = await openDoc(A, docId);
    const b = await openDoc(B, docId);
    a.getText("quill").insert(0, "AAA");
    b.getText("quill").insert(0, "BBB");
    await settle(400);
    const ta = a.getText("quill").toString();
    expect(ta).toHaveLength(6);
    expect(ta).toBe(b.getText("quill").toString());
    // The server's copy agrees too.
    const c = await openDoc(A, docId);
    expect(c.getText("quill").toString()).toBe(ta);
  });

  test("C (outsider) doc:open → forbidden; C doc:update without open → forbidden", async () => {
    const { C, docId } = await setup();
    expect(await emit(C, "doc:open", docId)).toEqual({ ok: false, error: "forbidden" });
    const y = new Y.Doc();
    y.getText("quill").insert(0, "evil");
    expect(await emit(C, "doc:update", docId, Y.encodeStateAsUpdate(y))).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  test("garbage ids → not_found", async () => {
    const { A } = await setup();
    expect(await emit(A, "doc:open", "nope")).toEqual({ ok: false, error: "not_found" });
    expect(await emit(A, "doc:open", "64b000000000000000000009")).toEqual({ ok: false, error: "not_found" });
    expect(await emit(A, "doc:rename", { $gt: "" }, "x")).toEqual({ ok: false, error: "not_found" });
    expect(await emit(A, "doc:update", "nope", new Uint8Array([0, 0]))).toEqual({ ok: false, error: "not_found" });
  });

  test("malformed update → invalid, and B receives nothing", async () => {
    const { A, B, docId } = await setup();
    await openDoc(A, docId);
    await openDoc(B, docId);
    const none = expectNoEvent(B, "doc:update");
    expect(await emit(A, "doc:update", docId, new Uint8Array([1, 2, 3]))).toEqual({ ok: false, error: "invalid" });
    expect(await emit(A, "doc:update", docId, "not binary")).toEqual({ ok: false, error: "invalid" });
    await none;
  });

  test("doc:rename broadcasts updated; doc:delete → joined members receive workspace:item deleted; later doc:open → not_found", async () => {
    const { A, B, docId } = await setup();
    let p = waitFor(B, "workspace:item", (d) => d.kind === "document" && d.action === "updated");
    const renamed = await emit(B, "doc:rename", docId, "Renamed");
    expect(renamed.ok).toBe(true);
    expect((await p).item.title).toBe("Renamed");

    await openDoc(A, docId);
    p = waitFor(B, "workspace:item", (d) => d.kind === "document" && d.action === "deleted");
    expect(await emit(A, "doc:delete", docId)).toEqual({ ok: true, data: null });
    expect((await p).item).toEqual({ _id: docId });
    expect(await DocumentModel.findById(docId)).toBeNull();
    expect(yDocManager.isLoaded(docId)).toBe(false);
    expect(await emit(B, "doc:open", docId)).toEqual({ ok: false, error: "not_found" });
    // A was in the doc room; after delete it may no longer write to it.
    const res = await emit(A, "doc:update", docId, new Uint8Array([0, 0]));
    expect(res.ok).toBe(false);
  });

  test("awareness from A is relayed to B but not echoed to A", async () => {
    const { A, B, C, docId } = await setup();
    await openDoc(A, docId);
    await openDoc(B, docId);
    const echo = expectNoEvent(A, "doc:awareness");
    const outsider = expectNoEvent(C, "doc:awareness");
    const got = waitFor(B, "doc:awareness");
    A.emit("doc:awareness", docId, new Uint8Array([9, 8, 7]));
    const ev = await got;
    expect(ev.docId).toBe(docId);
    expect([...bytes(ev.update)]).toEqual([9, 8, 7]);
    await Promise.all([echo, outsider]);
    // An outsider that never opened the doc can't inject awareness.
    const none = expectNoEvent(B, "doc:awareness");
    C.emit("doc:awareness", docId, new Uint8Array([1]));
    await none;
  });

  test("edits are persisted: after everyone closes, the stored state has the text", async () => {
    const { A, docId } = await setup();
    const a = await openDoc(A, docId);
    a.getText("quill").insert(0, "saved");
    await settle();
    expect(await emit(A, "doc:close", docId)).toEqual({ ok: true, data: null });
    expect(yDocManager.isLoaded(docId)).toBe(false);
    const stored = await DocumentModel.findById(docId).select("+ydocState");
    const y = new Y.Doc();
    Y.applyUpdate(y, new Uint8Array(stored!.ydocState!));
    expect(y.getText("quill").toString()).toBe("saved");
  });

  test("disconnecting the last socket flushes and evicts the doc", async () => {
    const { A, docId } = await setup();
    const a = await openDoc(A, docId);
    a.getText("quill").insert(0, "bye");
    await settle();
    A.close();
    await settle(300);
    expect(yDocManager.isLoaded(docId)).toBe(false);
    const stored = await DocumentModel.findById(docId).select("+ydocState");
    const y = new Y.Doc();
    Y.applyUpdate(y, new Uint8Array(stored!.ydocState!));
    expect(y.getText("quill").toString()).toBe("bye");
  });

  test("workspace:delete drops loaded docs without saving them", async () => {
    const { A, docId, wsId } = await setup();
    const a = await openDoc(A, docId);
    a.getText("quill").insert(0, "x");
    await settle();
    expect(yDocManager.isLoaded(docId)).toBe(true);
    expect((await emit(A, "workspace:delete", wsId)).ok).toBe(true);
    expect(yDocManager.isLoaded(docId)).toBe(false);
    expect(await DocumentModel.findById(docId)).toBeNull();
  });
});

describe("documentHandler — removed member (Review Focus 1)", () => {
  async function setupWithChat() {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");
    const chat = await makeChat([alice, bob], [alice]);
    const ws = await Workspace.create({ name: "W", chatRoomId: chat._id, createdBy: alice._id });
    const A = await connect(String(alice._id));
    const B = await connect(String(bob._id));
    const created = await emit(A, "doc:create", String(ws._id), "Notes");
    return { A, B, chatId: String(chat._id), bobId: String(bob._id), docId: String(created.data._id) };
  }

  async function removeFromChat(chatId: string, userId: string) {
    await ChatRoom.updateOne({ _id: chatId }, { $pull: { participants: new mongoose.Types.ObjectId(userId) } });
    await evictUserFromChatWorkspaces(server.io, chatId, userId);
  }

  test("after removal: doc:update → forbidden, no more doc:update/awareness, doc:open → forbidden", async () => {
    const { A, B, chatId, bobId, docId } = await setupWithChat();
    const a = await openDoc(A, docId);
    await openDoc(B, docId);
    await removeFromChat(chatId, bobId);

    const noUpdate = expectNoEvent(B, "doc:update");
    const noAwareness = expectNoEvent(B, "doc:awareness");
    a.getText("quill").insert(0, "secret");
    A.emit("doc:awareness", docId, new Uint8Array([1, 2]));
    await Promise.all([noUpdate, noAwareness]);

    const y = new Y.Doc();
    y.getText("quill").insert(0, "x");
    expect(await emit(B, "doc:update", docId, Y.encodeStateAsUpdate(y))).toEqual({ ok: false, error: "forbidden" });
    expect(await emit(B, "doc:open", docId)).toEqual({ ok: false, error: "forbidden" });
  });

  test("removed while doc:open is loading → forbidden and the socket is not left in the doc room", async () => {
    const { A, B, chatId, bobId, docId } = await setupWithChat();
    const original = yDocManager.open.bind(yDocManager);
    const spy = jest.spyOn(yDocManager, "open").mockImplementationOnce(async (id, socketId) => {
      await removeFromChat(chatId, bobId);
      return original(id, socketId);
    });
    expect(await emit(B, "doc:open", docId)).toEqual({ ok: false, error: "forbidden" });
    spy.mockRestore();

    const a = await openDoc(A, docId);
    const none = expectNoEvent(B, "doc:update");
    a.getText("quill").insert(0, "after removal");
    await none;
    expect((await emit(B, "doc:update", docId, new Uint8Array([0, 0]))).ok).toBe(false);
  });
});
