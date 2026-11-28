// Whiteboard toolbar palette and shortcuts. Colours must match the server's
// stroke rule (#rrggbb); widths must stay within 1–40px.
export const WB_COLORS = [
  { name: "Black", hex: "#222222" },
  { name: "Red", hex: "#e03131" },
  { name: "Blue", hex: "#1c7ed6" },
  { name: "Green", hex: "#2f9e44" },
  { name: "Yellow", hex: "#f2c94c" },
  { name: "Purple", hex: "#7b3fbf" },
];

export const WB_WIDTHS = [
  { name: "Thin", px: 2 },
  { name: "Medium", px: 4 },
  { name: "Thick", px: 8 },
];

function isTextField(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Ctrl+Z / Cmd+Z (not redo), outside text fields that have their own undo. */
export function isUndoShortcut(event) {
  if (!event || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return false;
  if (String(event.key).toLowerCase() !== "z") return false;
  return !isTextField(event.target);
}
