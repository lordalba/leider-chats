import { describe, it, expect } from "vitest";
import { groupChatOptions } from "../src/workspaces/chatOptions";

describe("groupChatOptions", () => {
  it("keeps group chats only", () => {
    const chats = [
      { _id: "g1", name: "Crew", isGroupChat: true },
      { _id: "d1", name: "", isGroupChat: false },
    ];
    expect(groupChatOptions(chats)).toEqual([{ value: "g1", text: "Crew" }]);
  });

  it("names an unnamed group", () => {
    expect(groupChatOptions([{ _id: "g1", isGroupChat: true }])).toEqual([
      { value: "g1", text: "Unnamed group" },
    ]);
  });

  it("sorts by name, ignoring case", () => {
    const chats = [
      { _id: "1", name: "beta", isGroupChat: true },
      { _id: "2", name: "Alpha", isGroupChat: true },
      { _id: "3", name: "Gamma", isGroupChat: true },
    ];
    expect(groupChatOptions(chats).map((o) => o.text)).toEqual(["Alpha", "beta", "Gamma"]);
  });

  it("handles a missing list", () => {
    expect(groupChatOptions(undefined)).toEqual([]);
  });
});
