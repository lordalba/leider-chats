/**
 * Presence helpers. A member is
 * { userId, username, profilePictureUrl, focus: { kind, id } | null }
 * and one user appears once per open browser tab.
 */

/** Everyone here except me, once per user (preferring a tab with a focus), by username. */
export function othersHere(members, meId) {
  const byUser = new Map();
  for (const member of members || []) {
    const id = String(member.userId);
    if (id === String(meId)) continue;
    const seen = byUser.get(id);
    if (!seen || (!seen.focus && member.focus)) byUser.set(id, member);
  }
  return [...byUser.values()].sort((a, b) =>
    String(a.username).localeCompare(String(b.username))
  );
}

/** "Only you here", "bob is here", "bob and carol are here", "bob, carol and 3 others are here". */
export function presenceLabel(others) {
  const names = (others || []).map((m) => m.username);
  if (names.length === 0) return "Only you here";
  if (names.length === 1) return `${names[0]} is here`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are here`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} ${rest === 1 ? "other" : "others"} are here`;
}

const FOCUS = {
  task: { list: "tasks", verb: "Viewing" },
  document: { list: "documents", verb: "Editing" },
  whiteboard: { list: "whiteboards", verb: "Drawing on" },
};

/** "Editing Itinerary" etc. for what the member has open; null if nothing (known). */
export function focusLabel(member, detail) {
  const focus = member && member.focus;
  const kind = focus && FOCUS[focus.kind];
  if (!kind || !detail) return null;
  const item = (detail[kind.list] || []).find((i) => String(i._id) === String(focus.id));
  return item ? `${kind.verb} ${item.title}` : null;
}
