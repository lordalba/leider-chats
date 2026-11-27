import { describe, it, expect } from "vitest";
import { canDeleteWorkspace, isChatAdminOrCreator } from "../src/workspaces/permissions";

const detail = {
  workspace: { _id: "w1", createdBy: "creator" },
  chat: { admins: ["admin"] },
};

describe("canDeleteWorkspace", () => {
  it("lets the creator delete", () => {
    expect(canDeleteWorkspace(detail, "creator")).toBe(true);
  });

  it("lets a chat admin delete", () => {
    expect(canDeleteWorkspace(detail, "admin")).toBe(true);
  });

  it("refuses any other member", () => {
    expect(canDeleteWorkspace(detail, "member")).toBe(false);
  });

  it("refuses without a user", () => {
    expect(canDeleteWorkspace(detail, null)).toBe(false);
    expect(canDeleteWorkspace(detail, undefined)).toBe(false);
  });

  it("refuses without a detail", () => {
    expect(canDeleteWorkspace(null, "creator")).toBe(false);
  });

  it("compares ids as strings", () => {
    const objectIds = {
      workspace: { createdBy: { toString: () => "creator" } },
      chat: { admins: [{ toString: () => "admin" }] },
    };
    expect(canDeleteWorkspace(objectIds, "creator")).toBe(true);
    expect(canDeleteWorkspace(objectIds, "admin")).toBe(true);
  });
});

describe("isChatAdminOrCreator", () => {
  it("checks a given creator, e.g. a whiteboard's", () => {
    expect(isChatAdminOrCreator(detail, "board-owner", "board-owner")).toBe(true);
    expect(isChatAdminOrCreator(detail, "admin", "board-owner")).toBe(true);
    expect(isChatAdminOrCreator(detail, "creator", "board-owner")).toBe(false);
  });

  it("works with no chat on the detail", () => {
    expect(isChatAdminOrCreator({ workspace: {} }, "x", "x")).toBe(true);
    expect(isChatAdminOrCreator({ workspace: {} }, "x", "y")).toBe(false);
  });
});
