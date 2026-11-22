import { WorkspacePresenceService } from "../../../src/services/workspaces/WorkspacePresenceService";

const alice = { userId: "u1", username: "alice" };
const bob = { userId: "u2", username: "bob" };

describe("WorkspacePresenceService", () => {
  beforeEach(() => WorkspacePresenceService.reset());

  it("same user in two sockets appears once", () => {
    WorkspacePresenceService.join("w1", "s1", alice);
    WorkspacePresenceService.join("w1", "s2", alice);
    expect(WorkspacePresenceService.members("w1")).toHaveLength(1);
  });

  it("closing one of two sockets keeps the user present", () => {
    WorkspacePresenceService.join("w1", "s1", alice);
    WorkspacePresenceService.join("w1", "s2", alice);
    WorkspacePresenceService.leave("w1", "s1");
    expect(WorkspacePresenceService.members("w1").map((m) => m.userId)).toEqual(["u1"]);
  });

  it("removeSocket returns affected workspaces and drops the user when it was the last socket", () => {
    WorkspacePresenceService.join("w1", "s1", alice);
    WorkspacePresenceService.join("w2", "s1", alice);
    WorkspacePresenceService.join("w2", "s2", bob);
    expect(WorkspacePresenceService.removeSocket("s1").sort()).toEqual(["w1", "w2"]);
    expect(WorkspacePresenceService.members("w1")).toEqual([]);
    expect(WorkspacePresenceService.members("w2").map((m) => m.userId)).toEqual(["u2"]);
    expect(WorkspacePresenceService.removeSocket("nope")).toEqual([]);
  });

  it("focus reflects the latest non-null focus across the user's sockets", () => {
    WorkspacePresenceService.join("w1", "s1", alice);
    WorkspacePresenceService.join("w1", "s2", alice);
    WorkspacePresenceService.setFocus("w1", "s1", { kind: "document", id: "d1" });
    WorkspacePresenceService.setFocus("w1", "s2", { kind: "task", id: "t1" });
    expect(WorkspacePresenceService.members("w1")[0].focus).toEqual({ kind: "task", id: "t1" });
    WorkspacePresenceService.setFocus("w1", "s2", null);
    expect(WorkspacePresenceService.members("w1")[0].focus).toEqual({ kind: "document", id: "d1" });
    WorkspacePresenceService.setFocus("w1", "s1", null);
    expect(WorkspacePresenceService.members("w1")[0].focus).toBeNull();
  });

  it("setFocus before join is a no-op", () => {
    WorkspacePresenceService.setFocus("w1", "s1", { kind: "document", id: "d1" });
    expect(WorkspacePresenceService.members("w1")).toEqual([]);
    WorkspacePresenceService.join("w1", "s1", alice);
    expect(WorkspacePresenceService.members("w1")[0].focus).toBeNull();
  });

  it("empty workspace returns []", () => {
    expect(WorkspacePresenceService.members("none")).toEqual([]);
    expect(WorkspacePresenceService.socketsOfUser("none", "u1")).toEqual([]);
  });

  it("orders members by first join, join is idempotent, socketsOfUser works", () => {
    WorkspacePresenceService.join("w1", "s1", alice);
    WorkspacePresenceService.join("w1", "s2", bob);
    WorkspacePresenceService.setFocus("w1", "s1", { kind: "task", id: "t" });
    WorkspacePresenceService.join("w1", "s1", alice);
    const m = WorkspacePresenceService.members("w1");
    expect(m.map((x) => x.userId)).toEqual(["u1", "u2"]);
    expect(m[0].focus).toEqual({ kind: "task", id: "t" });
    expect(WorkspacePresenceService.socketsOfUser("w1", "u1")).toEqual(["s1"]);
    WorkspacePresenceService.leave("w1", "unknown");
  });
});
