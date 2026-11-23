import { describe, expect, it } from "vitest";
import { hasCodeBlock, hasUnclosedFence, parseMessage } from "../src/chat/messageFormatter.js";

describe("parseMessage", () => {
  it("plain text is one text segment", () => {
    expect(parseMessage("hello there")).toEqual([{ type: "text", text: "hello there" }]);
  });

  it("finds a fenced code block with its language", () => {
    const segments = parseMessage("look:\n```js\nconst a = 1;\nconsole.log(a);\n```\nnice");
    expect(segments).toEqual([
      { type: "text", text: "look:" },
      { type: "codeblock", language: "js", code: "const a = 1;\nconsole.log(a);" },
      { type: "text", text: "nice" },
    ]);
  });

  it("finds inline code", () => {
    expect(parseMessage("run `npm test` now")).toEqual([
      { type: "text", text: "run " },
      { type: "code", text: "npm test" },
      { type: "text", text: " now" },
    ]);
  });

  it("keeps markup as text (no HTML injection)", () => {
    expect(parseMessage("<b>hi</b>")).toEqual([{ type: "text", text: "<b>hi</b>" }]);
  });

  it("handles a block without a language and an unclosed fence", () => {
    expect(parseMessage("```\nx\n```")).toEqual([{ type: "codeblock", language: "", code: "x" }]);
    expect(parseMessage("```\nnot closed")).toEqual([{ type: "text", text: "```\nnot closed" }]);
  });

  it("hasCodeBlock / hasUnclosedFence", () => {
    expect(hasCodeBlock("```\nx\n```")).toBe(true);
    expect(hasCodeBlock("`x`")).toBe(false);
    expect(hasUnclosedFence("```js\nlet a")).toBe(true);
    expect(hasUnclosedFence("```js\nlet a\n```")).toBe(false);
  });
});
