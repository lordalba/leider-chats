import { describe, it, expect } from "vitest";
import { WB_COLORS, WB_WIDTHS, isUndoShortcut } from "../src/workspaces/whiteboardUi";

const key = (extra = {}) => ({ key: "z", ctrlKey: false, metaKey: false, shiftKey: false, target: { tagName: "CANVAS" }, ...extra });

describe("isUndoShortcut", () => {
  it("accepts Ctrl+Z", () => {
    expect(isUndoShortcut(key({ ctrlKey: true }))).toBe(true);
  });

  it("accepts Cmd+Z", () => {
    expect(isUndoShortcut(key({ metaKey: true }))).toBe(true);
  });

  it("accepts an upper-case Z from caps lock", () => {
    expect(isUndoShortcut(key({ ctrlKey: true, key: "Z" }))).toBe(true);
  });

  it("rejects Ctrl+Shift+Z (redo)", () => {
    expect(isUndoShortcut(key({ ctrlKey: true, shiftKey: true, key: "Z" }))).toBe(false);
  });

  it("rejects a plain z", () => {
    expect(isUndoShortcut(key())).toBe(false);
  });

  it("leaves text fields alone", () => {
    expect(isUndoShortcut(key({ ctrlKey: true, target: { tagName: "INPUT" } }))).toBe(false);
    expect(isUndoShortcut(key({ ctrlKey: true, target: { tagName: "TEXTAREA" } }))).toBe(false);
    expect(isUndoShortcut(key({ ctrlKey: true, target: { tagName: "DIV", isContentEditable: true } }))).toBe(false);
  });
});

describe("whiteboard palette", () => {
  it("has named colours the server accepts", () => {
    expect(WB_COLORS.map((c) => c.name)).toEqual(["Black", "Red", "Blue", "Green", "Yellow", "Purple"]);
    WB_COLORS.forEach((c) => expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i));
  });

  it("has three named widths", () => {
    expect(WB_WIDTHS).toEqual([
      { name: "Thin", px: 2 },
      { name: "Medium", px: 4 },
      { name: "Thick", px: 8 },
    ]);
  });
});
