import { describe, it, expect } from "vitest";
import { entryPath } from "../src/entryRoute";

describe("entryPath", () => {
  it("opens the chats when logged in", () => {
    expect(entryPath("some.jwt.token")).toBe("/chatrooms");
  });

  it("opens the login page when logged out", () => {
    expect(entryPath(null)).toBe("/login");
    expect(entryPath("")).toBe("/login");
    expect(entryPath(undefined)).toBe("/login");
  });
});
