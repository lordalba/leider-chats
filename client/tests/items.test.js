import { describe, it, expect } from "vitest";
import { CURSOR_COLORS, userColor, itemErrorMessage, viewersById } from "../src/workspaces/items.js";

describe("userColor", () => {
  it("is stable for a user id and drawn from the 8-colour palette", () => {
    expect(CURSOR_COLORS).toHaveLength(8);
    const id = "64b0000000000000000000aa";
    expect(userColor(id)).toBe(userColor(id));
    expect(CURSOR_COLORS).toContain(userColor(id));
  });

  it("spreads different ids over more than one colour", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `64b0000000000000000000${String(i).padStart(2, "0")}`);
    expect(new Set(ids.map(userColor)).size).toBeGreaterThan(3);
  });

  it("tolerates a missing id", () => {
    expect(CURSOR_COLORS).toContain(userColor(undefined));
  });
});

describe("itemErrorMessage", () => {
  it("maps codes to copy per kind", () => {
    expect(itemErrorMessage("invalid", "document")).toBe("Titles must be 1–120 characters");
    expect(itemErrorMessage("not_found", "document")).toBe("This document was deleted");
    expect(itemErrorMessage("not_found", "whiteboard")).toBe("This whiteboard was deleted");
    expect(itemErrorMessage("forbidden", "document")).toBe("You no longer have access to this workspace");
    expect(itemErrorMessage("timeout", "whiteboard")).toBe("Connection problem — try again");
    expect(itemErrorMessage("unauthenticated", "document")).toBe("Your session expired — please log in again");
    expect(itemErrorMessage("too_large", "document")).toBe("That change is too large to sync (try a smaller image)");
    expect(itemErrorMessage("weird", "document")).toBe("Something went wrong");
  });
});

describe("viewersById", () => {
  it("groups members by the id they focus for one kind", () => {
    const members = [
      { userId: "u1", focus: { kind: "document", id: "d1" } },
      { userId: "u2", focus: { kind: "document", id: "d1" } },
      { userId: "u3", focus: { kind: "whiteboard", id: "d1" } },
      { userId: "u4", focus: null },
    ];
    const map = viewersById(members, "document");
    expect(map.d1.map((m) => m.userId)).toEqual(["u1", "u2"]);
    expect(Object.keys(map)).toEqual(["d1"]);
  });
});
