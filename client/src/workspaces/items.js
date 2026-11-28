import { SESSION_EXPIRED_MESSAGE } from "./taskBoard";

/** Fixed palette for remote cursors and whiteboard presence. */
export const CURSOR_COLORS = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#9a6324",
];

/** Stable colour for a user id (string hash into CURSOR_COLORS). */
export function userColor(userId) {
  const s = String(userId || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

const KIND_LABEL = { document: "document", whiteboard: "whiteboard" };

/** Toast copy for a document/whiteboard socket error code. */
export function itemErrorMessage(code, kind, context) {
  switch (code) {
    case "invalid":
      // Only create/rename send a title; strokes, undo and edits use the same code.
      return context === "title"
        ? "Titles must be 1–120 characters"
        : "The server rejected that change";
    case "not_found":
      return `This ${KIND_LABEL[kind] || "item"} was deleted`;
    case "forbidden":
      return "You no longer have access to this workspace";
    case "timeout":
      return "Connection problem — try again";
    case "unauthenticated":
      return SESSION_EXPIRED_MESSAGE;
    case "too_large":
      return "That change is too large to sync (try a smaller image)";
    case "diverged":
      return "This document stopped syncing because a change was too large or was rejected. Reload the page to continue (your latest changes will be lost).";
    default:
      return "Something went wrong";
  }
}

/** members -> { [itemId]: PresenceMember[] } for members focused on `kind`. */
export function viewersById(members, kind) {
  const map = {};
  (members || []).forEach((member) => {
    const focus = member && member.focus;
    if (!focus || focus.kind !== kind || !focus.id) return;
    (map[focus.id] = map[focus.id] || []).push(member);
  });
  return map;
}
