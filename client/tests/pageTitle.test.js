import { describe, it, expect } from "vitest";
import { pageTitle } from "../src/pageTitle";

describe("pageTitle", () => {
  it("suffixes the app name", () => {
    expect(pageTitle({ title: "Workspaces" })).toBe("Workspaces · Leider chats");
  });
  it("falls back to the app name", () => {
    expect(pageTitle({})).toBe("Leider chats");
    expect(pageTitle(undefined)).toBe("Leider chats");
  });
});
