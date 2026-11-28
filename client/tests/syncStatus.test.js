import { describe, it, expect } from "vitest";
import { syncLabel } from "../src/workspaces/syncStatus";

const ok = { connected: true, synced: true, diverged: false, retrying: false };

describe("syncLabel", () => {
  it("says all synced when connected and synced", () => {
    expect(syncLabel(ok)).toEqual({ text: "All changes synced", tone: "ok" });
  });

  it("says connecting before the first sync", () => {
    expect(syncLabel({ ...ok, synced: false })).toEqual({ text: "Connecting…", tone: "busy" });
  });

  it("says retrying after a failure", () => {
    expect(syncLabel({ ...ok, synced: false, retrying: true })).toEqual({
      text: "Connection problem — retrying…",
      tone: "warn",
    });
  });

  it("says offline when disconnected, over retrying", () => {
    expect(syncLabel({ ...ok, connected: false, synced: false, retrying: true })).toEqual({
      text: "Offline — changes will sync when you reconnect",
      tone: "warn",
    });
  });

  it("says not syncing when diverged, over everything", () => {
    expect(syncLabel({ connected: false, synced: false, diverged: true, retrying: true })).toEqual({
      text: "Not syncing — reload the page",
      tone: "error",
    });
  });

  it("treats a missing state as connecting", () => {
    expect(syncLabel(null).tone).toBe("busy");
  });
});
