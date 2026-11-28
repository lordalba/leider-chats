import { describe, it, expect } from "vitest";
import { confirmDanger } from "../src/workspaces/confirm";

function fakeModal(result) {
  const calls = [];
  return {
    calls,
    msgBoxConfirm(message, options) {
      calls.push({ message, options });
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
}

const ask = { title: "Delete task?", message: "“X” will be deleted for everyone.", okTitle: "Delete task" };

describe("confirmDanger", () => {
  it("resolves true when the user confirms", async () => {
    expect(await confirmDanger(fakeModal(true), ask)).toBe(true);
  });

  it("resolves false on cancel, backdrop/Esc (null) and a rejected dialog", async () => {
    expect(await confirmDanger(fakeModal(false), ask)).toBe(false);
    expect(await confirmDanger(fakeModal(null), ask)).toBe(false);
    expect(await confirmDanger(fakeModal(new Error("destroyed")), ask)).toBe(false);
  });

  it("asks with a red confirm, a plain Cancel and a centered dialog", async () => {
    const modal = fakeModal(true);
    await confirmDanger(modal, ask);
    expect(modal.calls).toHaveLength(1);
    expect(modal.calls[0].message).toBe(ask.message);
    expect(modal.calls[0].options).toMatchObject({
      title: "Delete task?",
      okTitle: "Delete task",
      okVariant: "danger",
      cancelTitle: "Cancel",
      cancelVariant: "outline-secondary",
      centered: true,
    });
  });
});
