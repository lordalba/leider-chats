import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { SocketYProvider } from "../src/workspaces/SocketYProvider.js";

const DOC_ID = "doc1";
const settle = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
};

/** Mimics the server: holds a Y.Doc, applies updates, relays them to the other sockets in the room. */
class Hub {
  constructor() {
    this.doc = new Y.Doc();
    this.sockets = new Set();
    this.received = [];
    this.events = [];
  }

  handle(sock, event, args, ack) {
    this.events.push(event);
    const reply = (res) => ack && ack(res);
    if (event === "doc:open") {
      sock.inRoom = true;
      reply({ ok: true, data: { update: Y.encodeStateAsUpdate(this.doc) } });
    } else if (event === "doc:update") {
      if (!sock.inRoom) return reply({ ok: false, error: "forbidden" });
      const update = args[1];
      this.received.push(update);
      Y.applyUpdate(this.doc, update);
      this.relay(sock, "doc:update", { docId: DOC_ID, update });
      reply({ ok: true, data: null });
    } else if (event === "doc:close") {
      sock.inRoom = false;
      reply({ ok: true, data: null });
    } else if (event === "doc:awareness") {
      if (sock.inRoom) this.relay(sock, "doc:awareness", { docId: DOC_ID, update: args[1] });
    }
    return undefined;
  }

  relay(from, event, payload) {
    this.sockets.forEach((other) => {
      if (other !== from && other.inRoom && other.connected) {
        setTimeout(() => other.fire(event, payload), 0);
      }
    });
  }

  text() {
    return this.doc.getText("quill").toString();
  }
}

class FakeSocket {
  constructor(hub) {
    this.hub = hub;
    this.handlers = {};
    this.connected = true;
    this.inRoom = false;
    hub.sockets.add(this);
  }

  on(event, fn) {
    (this.handlers[event] = this.handlers[event] || []).push(fn);
  }

  off(event, fn) {
    this.handlers[event] = (this.handlers[event] || []).filter((f) => f !== fn);
  }

  fire(event, ...args) {
    (this.handlers[event] || []).slice().forEach((fn) => fn(...args));
  }

  emit(event, ...args) {
    if (!this.connected) return;
    const ack = typeof args[args.length - 1] === "function" ? args.pop() : null;
    setTimeout(() => this.hub.handle(this, event, args, ack), 0);
  }

  drop() {
    this.connected = false;
    this.inRoom = false;
    this.fire("disconnect");
  }

  restore() {
    this.connected = true;
    this.fire("connect");
  }
}

const makePeer = async (hub) => {
  const socket = new FakeSocket(hub);
  const doc = new Y.Doc();
  const provider = new SocketYProvider(socket, DOC_ID, doc);
  await provider.connect();
  return { socket, doc, provider, text: () => doc.getText("quill").toString() };
};

describe("SocketYProvider", () => {
  it("two providers on one hub converge after each inserts text", async () => {
    const hub = new Hub();
    const a = await makePeer(hub);
    const b = await makePeer(hub);
    expect(a.provider.synced).toBe(true);

    a.doc.getText("quill").insert(0, "hello ");
    b.doc.getText("quill").insert(0, "world ");
    await settle();

    expect(a.text()).toBe(b.text());
    expect(hub.text()).toBe(a.text());
    expect(a.text()).toContain("hello ");
    expect(a.text()).toContain("world ");
  });

  it("Review Focus 3: B disconnects, inserts 'offline', reconnects → hub and A contain it exactly once", async () => {
    const hub = new Hub();
    const a = await makePeer(hub);
    const b = await makePeer(hub);

    b.socket.drop();
    b.doc.getText("quill").insert(0, "offline");
    a.doc.getText("quill").insert(0, "online");
    await settle();
    expect(hub.text()).toBe("online");

    b.socket.restore();
    await settle();

    const count = (s, sub) => s.split(sub).length - 1;
    expect(count(hub.text(), "offline")).toBe(1);
    expect(count(a.text(), "offline")).toBe(1);
    expect(count(b.text(), "online")).toBe(1);
    expect(a.text()).toBe(b.text());
    expect(hub.text()).toBe(a.text());
  });

  it("updates received from the hub are not re-emitted (no echo loop)", async () => {
    const hub = new Hub();
    const a = await makePeer(hub);
    await makePeer(hub);

    a.doc.getText("quill").insert(0, "x");
    await settle();
    expect(hub.received).toHaveLength(1);
  });

  it("destroy stops emitting and emits doc:close", async () => {
    const hub = new Hub();
    const a = await makePeer(hub);
    a.provider.destroy();
    await settle();
    expect(hub.events).toContain("doc:close");

    a.doc.getText("quill").insert(0, "after destroy");
    await settle();
    expect(hub.received).toHaveLength(0);
    expect(hub.text()).toBe("");
  });

  it("emits synced and relays awareness between peers", async () => {
    const hub = new Hub();
    const a = await makePeer(hub);
    const b = await makePeer(hub);
    a.provider.awareness.setLocalStateField("user", { name: "alice" });
    await settle();
    const remote = b.provider.awareness.getStates().get(a.doc.clientID);
    expect(remote && remote.user.name).toBe("alice");
  });
});
