/**
 * Splits chat message text into segments for display:
 *  - { type: "codeblock", language, code }  from ```lang\n...\n```
 *  - { type: "code", text }                 from `inline code`
 *  - { type: "text", text }                 everything else
 * The result is rendered with Vue templates (never v-html), so messages can't inject markup.
 */
const FENCE = /```([\w#+.-]*)[ \t]*\n?([\s\S]*?)```/g;
const INLINE_CODE = /`([^`\n]+)`/g;

function pushInline(segments, text) {
  if (!text) return;
  let last = 0;
  let match;
  INLINE_CODE.lastIndex = 0;
  while ((match = INLINE_CODE.exec(text))) {
    if (match.index > last) segments.push({ type: "text", text: text.slice(last, match.index) });
    segments.push({ type: "code", text: match[1] });
    last = INLINE_CODE.lastIndex;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
}

export function parseMessage(text) {
  const source = String(text || "");
  const segments = [];
  let last = 0;
  let match;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(source))) {
    // Drop the line break right before/after a block; the block itself is a separate box.
    pushInline(segments, source.slice(last, match.index).replace(/\n$/, ""));
    segments.push({ type: "codeblock", language: match[1] || "", code: match[2].replace(/\n$/, "") });
    last = FENCE.lastIndex;
    if (source[last] === "\n") last += 1;
  }
  pushInline(segments, source.slice(last));
  return segments;
}

export const hasCodeBlock = (text) => parseMessage(text).some((segment) => segment.type === "codeblock");

/** True while the user is in the middle of a ``` block (Enter should add a line, not send). */
export const hasUnclosedFence = (text) => ((String(text || "").match(/```/g) || []).length % 2) === 1;
