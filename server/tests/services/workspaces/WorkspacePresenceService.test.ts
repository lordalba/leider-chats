import { WorkspacePresenceService as P } from "../../../src/services/workspaces/WorkspacePresenceService";

const alice = { userId: "a", username: "alice" };
const bob = { userId: "b", username: "bob" };

describe("WorkspacePresenceService", () => {
  beforeEach(() => P.reset());

  it("same user in two sockets appears once", () => {
    P.join("w", "s1", alice);
    P.join("w", "s2", alice);
    expect(P.members("w")).toHaveLength(1);
  });

  it("closing one of two sockets keeps the user present", () => {
    P.join("w", "s1", alice);
    P.join("w", "s2", alice);
    P.leave("w", "s1");
    expect(P.members("w").map((m) => m.userId)).toEqual(["a"]);
  });

  it("removeSocket returns affected workspaces and drops the user when it was the last socket", () => {
    P.join("w1", "s1", alice);
    P.join("w2", "s1", alice);
    P.join("w2", "s2", bob);
    expect(P.removeSocket("s1").sort()).toEqual(["w1", "w2"]);
    expect(P.members("w1")).toEqual([]);
    expect(P.members("w2").map((m) => m.userId)).toEqual(["b"]);
  });

  it("focus reflects the latest non-null focus across the user's sockets", () => {
    P.join("w", "s1", alice);
    P.join("w", "s2", alice);
    P.setFocus("w", "s1", { kind: "task", id: "t1" });
    P.setFocus("w", "s2", { kind: "document", id: "d1" });
    expect(P.members("w")[0].focus).toEqual({ kind: "document", id: "d1" });
    P.setFocus("w", "s2", null);
    expect(P.members("w")[0].focus).toEqual({ kind: "task", id: "t1" });
  });

  it("setFocus before join is a no-op", () => {
    P.setFocus("w", "s1", { kind: "task", id: "t1" });
    expect(P.members("w")).toEqual([]);
  });

  it("empty workspace returns []", () => {
    expect(P.members("nothing")).toEqual([]);
  });

  it("socketsOfUser lists only that user's sockets", () => {
    P.join("w", "s1", alice);
    P.join("w", "s2", bob);
    P.join("w", "s3", alice);
    expect(P.socketsOfUser("w", "a").sort()).toEqual(["s1", "s3"]);
  });
});
