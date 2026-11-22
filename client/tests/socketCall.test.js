import { describe, it, expect, vi, afterEach } from "vitest";
import { emitWithAck, ensureSocket } from "../src/workspaces/socketCall.js";

function fakeSocket(response) {
  return {
    emitted: [],
    emit(event, ...args) {
      const ack = args[args.length - 1];
      this.emitted.push({ event, args: args.slice(0, -1) });
      if (response !== undefined) ack(response);
    },
  };
}

describe("emitWithAck", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves data on ok:true", async () => {
    const socket = fakeSocket({ ok: true, data: { members: [1] } });
    await expect(emitWithAck(socket, "workspace:join", "w1")).resolves.toEqual({
      members: [1],
    });
    expect(socket.emitted).toEqual([{ event: "workspace:join", args: ["w1"] }]);
  });

  it("rejects with error code on ok:false", async () => {
    const socket = fakeSocket({ ok: false, error: "forbidden" });
    await expect(emitWithAck(socket, "workspace:join", "w1")).rejects.toThrow(
      "forbidden"
    );
  });

  it('rejects "timeout" after 10000 ms', async () => {
    vi.useFakeTimers();
    const socket = fakeSocket(undefined);
    const promise = emitWithAck(socket, "workspace:join", "w1");
    let settled = false;
    promise.catch(() => {}).finally(() => {
      settled = true;
    });
    vi.advanceTimersByTime(9999);
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    vi.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow("timeout");
  });
});

describe("ensureSocket token handling", () => {
  function fakeStore() {
    const store = {
      socket: null,
      dispatched: [],
      getters: {},
      dispatch(action) {
        this.dispatched.push(action);
        this.socket = { id: "new" };
      },
    };
    Object.defineProperty(store.getters, "socket/socket", {
      get: () => store.socket,
    });
    return store;
  }

  function withToken(token) {
    vi.stubGlobal("localStorage", { getItem: () => token });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([null, "", "null"])("does not create a socket for token %j", (token) => {
    withToken(token);
    const store = fakeStore();
    expect(ensureSocket(store)).toBeNull();
    expect(store.dispatched).toEqual([]);
  });

  it("creates the socket when a real token is stored", () => {
    withToken("abc.def.ghi");
    const store = fakeStore();
    expect(ensureSocket(store)).toEqual({ id: "new" });
    expect(store.dispatched).toEqual(["socket/initializeSocket"]);
  });

  it("returns the existing socket without dispatching", () => {
    withToken("abc.def.ghi");
    const store = fakeStore();
    store.socket = { id: "existing" };
    expect(ensureSocket(store)).toEqual({ id: "existing" });
    expect(store.dispatched).toEqual([]);
  });
});
