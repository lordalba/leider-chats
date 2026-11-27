import { describe, it, expect } from "vitest";
import { groupWorkspaces } from "../src/workspaces/workspaceList";

const list = [
  { _id: "1", name: "zeta", chatRoomId: "c2", chatName: "Family" },
  { _id: "2", name: "Beta", chatRoomId: "c1", chatName: "Road trip crew" },
  { _id: "3", name: "alpha", chatRoomId: "c1", chatName: "Road trip crew" },
  { _id: "4", name: "Budget", chatRoomId: "c2", chatName: "Family" },
];
const shape = (groups) => groups.map((g) => [g.chatName, g.workspaces.map((w) => w.name)]);

describe("groupWorkspaces", () => {
  it("groups by chat in first-seen order", () => {
    const groups = groupWorkspaces(list);
    expect(groups.map((g) => g.chatRoomId)).toEqual(["c2", "c1"]);
    expect(groups[0]).toMatchObject({ chatRoomId: "c2", chatName: "Family" });
  });

  it("sorts workspaces by name, ignoring case", () => {
    expect(shape(groupWorkspaces(list))).toEqual([
      ["Family", ["Budget", "zeta"]],
      ["Road trip crew", ["alpha", "Beta"]],
    ]);
  });

  it("filters by workspace name, trimmed and ignoring case", () => {
    expect(shape(groupWorkspaces(list, "  BUD "))).toEqual([["Family", ["Budget"]]]);
  });

  it("keeps a whole chat when the query matches its name", () => {
    expect(shape(groupWorkspaces(list, "road"))).toEqual([["Road trip crew", ["alpha", "Beta"]]]);
  });

  it("drops groups left empty", () => {
    expect(groupWorkspaces(list, "nothing matches")).toEqual([]);
  });

  it("does not mutate its input", () => {
    const copy = list.map((w) => ({ ...w }));
    groupWorkspaces(list);
    expect(list).toEqual(copy);
  });

  it("handles a missing list", () => {
    expect(groupWorkspaces(undefined)).toEqual([]);
  });
});
