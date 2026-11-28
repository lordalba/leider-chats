import { describe, it, expect, vi } from "vitest";
import { restoreSession } from "../src/auth/restoreSession";

function deps(overrides = {}) {
  return {
    token: "some.jwt.token",
    fetchUser: vi.fn().mockResolvedValue({ data: { _id: "u1", username: "maya" } }),
    setUser: vi.fn(),
    connect: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

describe("restoreSession", () => {
  it("restores the user and reconnects the socket when the token is valid", async () => {
    const d = deps();
    await expect(restoreSession(d)).resolves.toBe("restored");
    expect(d.setUser).toHaveBeenCalledWith({ _id: "u1", username: "maya" });
    expect(d.connect).toHaveBeenCalled();
    expect(d.clear).not.toHaveBeenCalled();
  });

  it("sets the user before connecting (the socket emits the user id)", async () => {
    const order = [];
    const d = deps({
      setUser: vi.fn(() => order.push("user")),
      connect: vi.fn(() => order.push("socket")),
    });
    await restoreSession(d);
    expect(order).toEqual(["user", "socket"]);
  });

  it("does nothing without a usable token", async () => {
    for (const token of [null, "", "null", undefined]) {
      const d = deps({ token });
      await expect(restoreSession(d)).resolves.toBe("anonymous");
      expect(d.fetchUser).not.toHaveBeenCalled();
      expect(d.clear).not.toHaveBeenCalled();
    }
  });

  it("clears a stale \"null\" token left by older logouts", async () => {
    const d = deps({ token: "null" });
    await restoreSession(d);
    expect(d.setUser).not.toHaveBeenCalled();
  });

  it.each([401, 403])("logs out when the server rejects the token (%i)", async (status) => {
    const d = deps({
      fetchUser: vi.fn().mockRejectedValue({ response: { status } }),
    });
    await expect(restoreSession(d)).resolves.toBe("expired");
    expect(d.clear).toHaveBeenCalled();
    expect(d.setUser).not.toHaveBeenCalled();
    expect(d.connect).not.toHaveBeenCalled();
  });

  it("keeps the token when the server is unreachable", async () => {
    const d = deps({
      fetchUser: vi.fn().mockRejectedValue(new Error("Network Error")),
    });
    await expect(restoreSession(d)).resolves.toBe("offline");
    expect(d.clear).not.toHaveBeenCalled();
    expect(d.connect).not.toHaveBeenCalled();
  });
});
