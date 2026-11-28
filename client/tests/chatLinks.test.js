import { describe, it, expect } from "vitest";
import { workspaceMessageParts } from "../src/workspaces/chatLinks";

describe("workspaceMessageParts", () => {
  it("splits out the quoted workspace name", () => {
    expect(workspaceMessageParts('alice created the workspace "Trip"')).toEqual({
      before: "alice created the workspace ",
      name: "Trip",
      after: "",
    });
  });

  it("uses the last quoted part when the user name has quotes", () => {
    expect(workspaceMessageParts('"al" created the workspace "A "b" c"')).toEqual({
      before: '"al" created the workspace ',
      name: 'A "b" c',
      after: "",
    });
  });

  it("returns null when there is nothing quoted", () => {
    expect(workspaceMessageParts("bob joined")).toBe(null);
    expect(workspaceMessageParts(undefined)).toBe(null);
  });
});
