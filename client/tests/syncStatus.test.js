import { describe, it, expect } from "vitest";
import { syncLabel } from "../src/workspaces/syncStatus";

const ok = { connected: true, synced: true, diverged: false, retrying: false };

describe("syncLabel", () => {
  it("says all synced when connected and synced", () => {
    expect(syncLabel(ok)).toMatchObject({ text: "All changes synced", tone: "ok" });
  });

  it("says connecting before the first sync", () => {
    expect(syncLabel({ ...ok, synced: false })).toMatchObject({ text: "Connecting…", tone: "busy" });
  });

  it("says retrying after a failure", () => {
    expect(syncLabel({ ...ok, synced: false, retrying: true })).toMatchObject({
      text: "Connection problem — retrying…",
      tone: "warn",
    });
  });

  it("says offline when disconnected, over retrying", () => {
    expect(syncLabel({ ...ok, connected: false, synced: false, retrying: true })).toMatchObject({
      text: "Offline — changes will sync when you reconnect",
      tone: "warn",
    });
  });

  it("says not syncing when diverged, over everything", () => {
    expect(syncLabel({ connected: false, synced: false, diverged: true, retrying: true })).toMatchObject({
      text: "Not syncing — reload the page",
      tone: "error",
    });
  });

  it("treats a missing state as connecting", () => {
    expect(syncLabel(null).tone).toBe("busy");
  });
});

describe("syncLabel short text (phones)", () => {
  it("has a short form for every state", () => {
    const base = { connected: true, synced: true, diverged: false, retrying: false };
    expect(syncLabel(base).short).toBe("Synced");
    expect(syncLabel({ ...base, synced: false }).short).toBe("Connecting…");
    expect(syncLabel({ ...base, synced: false, retrying: true }).short).toBe("Retrying…");
    expect(syncLabel({ ...base, connected: false }).short).toBe("Offline");
    expect(syncLabel({ ...base, diverged: true }).short).toBe("Not syncing");
  });
});
