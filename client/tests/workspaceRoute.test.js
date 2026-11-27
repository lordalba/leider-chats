import { describe, it, expect } from "vitest";
import { TABS, parseWorkspaceRoute, workspacePath } from "../src/workspaces/workspaceRoute";

describe("workspaceRoute", () => {
  it("lists the three tabs in order", () => {
    expect(TABS.map((t) => t.slug)).toEqual(["tasks", "documents", "whiteboards"]);
    expect(TABS.map((t) => t.label)).toEqual(["Tasks", "Documents", "Whiteboards"]);
  });

  it("round-trips every tab through a path", () => {
    const cases = [
      { workspaceId: "w1", tab: "tasks", itemId: null },
      { workspaceId: "w1", tab: "documents", itemId: null },
      { workspaceId: "w1", tab: "documents", itemId: "d1" },
      { workspaceId: "w1", tab: "whiteboards", itemId: null },
      { workspaceId: "w1", tab: "whiteboards", itemId: "b1" },
    ];
    for (const route of cases) {
      const [, , workspaceId, tab, itemId] = workspacePath(route).split("/");
      expect(parseWorkspaceRoute({ workspaceId, tab, itemId })).toEqual(route);
    }
  });

  it("treats an unknown or missing tab as tasks", () => {
    expect(parseWorkspaceRoute({ workspaceId: "w", tab: "foo" }).tab).toBe("tasks");
    expect(parseWorkspaceRoute({ workspaceId: "w" }).tab).toBe("tasks");
  });

  it("ignores an item id on the tasks tab", () => {
    expect(parseWorkspaceRoute({ workspaceId: "w", tab: "tasks", itemId: "x" }).itemId).toBe(null);
  });

  it("has no workspace when none is in the route", () => {
    expect(parseWorkspaceRoute({})).toEqual({ workspaceId: null, tab: "tasks", itemId: null });
  });

  it("builds short paths", () => {
    expect(workspacePath({ workspaceId: "w" })).toBe("/workspaces/w");
    expect(workspacePath({ workspaceId: "w", tab: "tasks", itemId: "x" })).toBe("/workspaces/w");
    expect(workspacePath({ workspaceId: "w", tab: "documents" })).toBe("/workspaces/w/documents");
    expect(workspacePath({ workspaceId: "abc", tab: "documents", itemId: "d1" })).toBe("/workspaces/abc/documents/d1");
    expect(workspacePath({})).toBe("/workspaces");
  });
});
