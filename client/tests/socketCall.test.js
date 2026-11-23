import { afterEach, describe, expect, it, vi } from "vitest";
import { emitWithAck, errorMessage } from "../src/socket/socketCall.js";

const fakeSocket = (respond) => ({
  emit: vi.fn((...args) => {
    const ack = args[args.length - 1];
    if (respond) respond(ack, args.slice(0, -1));
  }),
});

describe("emitWithAck", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves data on ok:true", async () => {
    const socket = fakeSocket((ack) => ack({ ok: true, data: { id: 1 } }));
    await expect(emitWithAck(socket, "x:y", "a", 2)).resolves.toEqual({ id: 1 });
    expect(socket.emit.mock.calls[0].slice(0, 3)).toEqual(["x:y", "a", 2]);
  });

  it("rejects with error code on ok:false", async () => {
    const socket = fakeSocket((ack) => ack({ ok: false, error: "forbidden" }));
    await expect(emitWithAck(socket, "x")).rejects.toThrow("forbidden");
  });

  it('rejects "timeout" after 10000 ms', async () => {
    vi.useFakeTimers();
    const socket = fakeSocket(null);
    const promise = emitWithAck(socket, "x");
    const assertion = expect(promise).rejects.toThrow("timeout");
    vi.advanceTimersByTime(9999);
    vi.advanceTimersByTime(1);
    await assertion;
  });

  it("ignores a late ack after the timeout", async () => {
    vi.useFakeTimers();
    let lateAck;
    const socket = fakeSocket((ack) => (lateAck = ack));
    const promise = emitWithAck(socket, "x");
    vi.advanceTimersByTime(10000);
    await expect(promise).rejects.toThrow("timeout");
    expect(() => lateAck({ ok: true, data: 1 })).not.toThrow();
  });

  it("rejects when there is no socket", async () => {
    await expect(emitWithAck(null, "x")).rejects.toThrow("not_connected");
  });

  it("errorMessage maps codes to text", () => {
    expect(errorMessage(new Error("forbidden"))).toMatch(/permission/);
    expect(errorMessage(new Error("weird"))).toMatch(/went wrong/);
  });
});
