import { describe, it, expect } from "vitest";
import { workspacePatch } from "../src/workspaces/workspaceEdit";

const opened = { name: "Trip", description: "Old" };

describe("workspacePatch", () => {
  it("sends only the fields the user changed", () => {
    expect(workspacePatch(opened, { name: "Trip", description: "New" })).toEqual({ description: "New" });
    expect(workspacePatch(opened, { name: "Road trip", description: "Old" })).toEqual({ name: "Road trip" });
  });

  it("is empty when nothing changed", () => {
    expect(workspacePatch(opened, { name: "Trip", description: "Old" })).toEqual({});
  });

  it("trims before comparing", () => {
    expect(workspacePatch(opened, { name: " Trip ", description: "Old  " })).toEqual({});
  });

  it("can clear the description", () => {
    expect(workspacePatch(opened, { name: "Trip", description: "  " })).toEqual({ description: "" });
  });

  it("treats a missing description as empty", () => {
    expect(workspacePatch({ name: "Trip" }, { name: "Trip", description: "" })).toEqual({});
  });
});

import { workspaceFieldError } from "../src/workspaces/workspaceEdit";

describe("workspaceFieldError", () => {
  it("asks for a name first", () => {
    expect(workspaceFieldError({ name: "  ", description: "" })).toBe("Give the workspace a name first");
  });

  it("is null for valid input", () => {
    expect(workspaceFieldError({ name: "Trip", description: "x".repeat(500) })).toBe(null);
  });

  it("names the field that is too long", () => {
    expect(workspaceFieldError({ name: "x".repeat(81), description: "" })).toBe("Names can be up to 80 characters");
    expect(workspaceFieldError({ name: "Trip", description: "x".repeat(501) })).toBe(
      "Descriptions can be up to 500 characters"
    );
  });
});
