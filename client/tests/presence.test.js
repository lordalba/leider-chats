import { describe, it, expect } from "vitest";
import { othersHere, presenceLabel, focusLabel } from "../src/workspaces/presence";

const m = (userId, username, focus = null) => ({ userId, username, profilePictureUrl: "", focus });

describe("othersHere", () => {
  it("drops me, dedupes one user's several tabs, sorts by username", () => {
    const members = [m("3", "carol"), m("1", "me"), m("2", "bob"), m("3", "carol", { kind: "document", id: "d" })];
    expect(othersHere(members, "1").map((x) => x.username)).toEqual(["bob", "carol"]);
  });

  it("keeps the copy with a focus when one user has several tabs", () => {
    const members = [m("3", "carol"), m("3", "carol", { kind: "document", id: "d" })];
    expect(othersHere(members, "1")[0].focus).toEqual({ kind: "document", id: "d" });
  });

  it("handles a missing member list", () => {
    expect(othersHere(undefined, "1")).toEqual([]);
  });
});

describe("presenceLabel", () => {
  const people = (n) => Array.from({ length: n }, (_, i) => m(String(i), `u${i}`));
  it("words 0, 1, 2 and many people", () => {
    expect(presenceLabel([])).toBe("Only you here");
    expect(presenceLabel([m("2", "bob")])).toBe("bob is here");
    expect(presenceLabel([m("2", "bob"), m("3", "carol")])).toBe("bob and carol are here");
    expect(presenceLabel(people(30))).toBe("u0, u1 and 28 others are here");
  });
  it("uses singular for exactly one other beyond the first two", () => {
    expect(presenceLabel(people(3))).toBe("u0, u1 and 1 other are here");
  });
});

describe("focusLabel", () => {
  const detail = {
    tasks: [{ _id: "t1", title: "Book campsites" }],
    documents: [{ _id: "d1", title: "Itinerary" }],
    whiteboards: [{ _id: "w1", title: "Route sketch" }],
  };
  it("names what the member has open", () => {
    expect(focusLabel(m("2", "bob", { kind: "document", id: "d1" }), detail)).toBe("Editing Itinerary");
    expect(focusLabel(m("2", "bob", { kind: "whiteboard", id: "w1" }), detail)).toBe("Drawing on Route sketch");
    expect(focusLabel(m("2", "bob", { kind: "task", id: "t1" }), detail)).toBe("Viewing Book campsites");
  });
  it("is null without a focus, or when the item is not in the workspace", () => {
    expect(focusLabel(m("2", "bob"), detail)).toBeNull();
    expect(focusLabel(m("2", "bob", { kind: "document", id: "gone" }), detail)).toBeNull();
    expect(focusLabel(m("2", "bob", { kind: "document", id: "d1" }), null)).toBeNull();
  });
});
