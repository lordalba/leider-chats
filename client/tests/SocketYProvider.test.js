import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { SocketYProvider } from "../src/workspaces/SocketYProvider.js";

const DOC = "d1";
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** Mimics the server: one Y.Doc per hub, relays updates to the other sockets. */
class FakeHub {
  constructor() {
    this.doc = new Y.Doc();
    this.sockets = new Set();
    this.received = []; // every doc:update payload the hub accepted
    this.events = []; // every event name the hub received
    this.open = new Set();
  }

  socket() {
    const s = new FakeSocket(this);
    this.sockets.add(s);
    return s;
  }

  handle(from, event, args, ack) {
    this.events.push(event);
    const reply = (res) => ack && setTimeout(() => from.connected && ack(res), 1);
    if (event === "doc:open") {
      this.open.add(from);
      reply({ ok: true, data: { update: Y.encodeStateAsUpdate(this.doc) } });
    } else if (event === "doc:close") {
      this.open.delete(from);
      reply({ ok: true, data: null });
    } else if (event === "doc:update") {
      if (!this.open.has(from)) return reply({ ok: false, error: "forbidden" });
      const update = new Uint8Array(args[1]);
      this.received.push(update);
      Y.applyUpdate(this.doc, update);
      for (const s of this.open) {
        if (s !== from && s.connected) s.deliver("doc:update", { docId: DOC, update });
      }
      reply({ ok: true, data: null });
    } else if (event === "doc:awareness") {
      for (const s of this.open) {
        if (s !== from && s.connected) s.deliver("doc:awareness", { docId: DOC, update: args[1] });
      }
    }
  }
}

class FakeSocket {
  constructor(hub) {
    this.hub = hub;
    this.connected = true;
    this.handlers = new Map();
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
  }

  off(event, fn) {
    const set = this.handlers.get(event);
    if (set) set.delete(fn);
  }

  listenerCount() {
    let n = 0;
    for (const set of this.handlers.values()) n += set.size;
    return n;
  }

  emit(event, ...args) {
    const ack = typeof args[args.length - 1] === "function" ? args.pop() : null;
    if (!this.connected) return; // lost on the wire
    setTimeout(() => this.hub.handle(this, event, args, ack), 1);
  }

  deliver(event, payload) {
    setTimeout(() => {
      if (!this.connected) return;
      for (const fn of [...(this.handlers.get(event) || [])]) fn(payload);
    }, 1);
  }

  drop() {
    this.connected = false;
    // The server forgets a dead socket's open docs.
    this.hub.open.delete(this);
    for (const fn of [...(this.handlers.get("disconnect") || [])]) fn("transport close");
  }

  reconnect() {
    this.connected = true;
    for (const fn of [...(this.handlers.get("connect") || [])]) fn();
  }
}

function text(doc) {
  return doc.getText("quill").toString();
}

async function makeProvider(hub) {
  const socket = hub.socket();
  const ydoc = new Y.Doc();
  const provider = new SocketYProvider(socket, DOC, ydoc);
  await provider.connect();
  return { socket, ydoc, provider };
}

describe("SocketYProvider", () => {
  it("two providers on one hub converge after each inserts text", async () => {
    const hub = new FakeHub();
    const a = await makeProvider(hub);
    const b = await makeProvider(hub);
    expect(a.provider.synced).toBe(true);
    a.ydoc.getText("quill").insert(0, "hello ");
    b.ydoc.getText("quill").insert(0, "world");
    await tick(30);
    expect(text(a.ydoc)).toBe(text(b.ydoc));
    expect(text(hub.doc)).toBe(text(a.ydoc));
    expect(text(a.ydoc)).toHaveLength(11);
  });

  it("loads the existing server state on connect and emits synced", async () => {
    const hub = new FakeHub();
    hub.doc.getText("quill").insert(0, "existing");
    const socket = hub.socket();
    const ydoc = new Y.Doc();
    const provider = new SocketYProvider(socket, DOC, ydoc);
    let synced = 0;
    provider.on("synced", () => synced++);
    expect(provider.synced).toBe(false);
    await provider.connect();
    expect(text(ydoc)).toBe("existing");
    expect(synced).toBe(1);
  });

  it('provider B disconnects, inserts "offline", reconnects → hub and A contain "offline" exactly once', async () => {
    const hub = new FakeHub();
    const a = await makeProvider(hub);
    const b = await makeProvider(hub);
    a.ydoc.getText("quill").insert(0, "base ");
    await tick(30);

    b.socket.drop();
    expect(b.provider.synced).toBe(false);
    b.ydoc.getText("quill").insert(text(b.ydoc).length, "offline");
    a.ydoc.getText("quill").insert(0, ">");
    await tick(30);
    expect(text(hub.doc)).not.toContain("offline");

    b.socket.reconnect();
    await tick(50);
    expect(b.provider.synced).toBe(true);
    for (const doc of [hub.doc, a.ydoc, b.ydoc]) {
      expect(text(doc).split("offline")).toHaveLength(2);
    }
    expect(text(a.ydoc)).toBe(text(b.ydoc));
    expect(text(hub.doc)).toBe(">base offline");
  });

  it("updates received from the hub are not re-emitted (no echo loop: hub receives each update once)", async () => {
    const hub = new FakeHub();
    const a = await makeProvider(hub);
    await makeProvider(hub);
    a.ydoc.getText("quill").insert(0, "x");
    await tick(30);
    a.ydoc.getText("quill").insert(1, "y");
    await tick(30);
    expect(hub.received).toHaveLength(2);
  });

  it("destroy stops emitting and emits doc:close", async () => {
    const hub = new FakeHub();
    const a = await makeProvider(hub);
    const before = a.socket.listenerCount();
    expect(before).toBeGreaterThan(0);
    a.provider.destroy();
    await tick(10);
    expect(hub.events).toContain("doc:close");
    expect(a.socket.listenerCount()).toBe(0);
    a.ydoc.getText("quill").insert(0, "after");
    await tick(30);
    expect(hub.received).toHaveLength(0);
    // A reconnect after destroy does not re-open the doc.
    const opens = hub.events.filter((e) => e === "doc:open").length;
    a.socket.reconnect();
    await tick(20);
    expect(hub.events.filter((e) => e === "doc:open").length).toBe(opens);
  });

  it("relays awareness between providers", async () => {
    const hub = new FakeHub();
    const a = await makeProvider(hub);
    const b = await makeProvider(hub);
    a.provider.awareness.setLocalStateField("user", { name: "alice", color: "#123456" });
    await tick(30);
    const states = [...b.provider.awareness.getStates().values()];
    expect(states).toContainEqual(expect.objectContaining({ user: { name: "alice", color: "#123456" } }));
    a.provider.destroy();
    b.provider.destroy();
  });
});
