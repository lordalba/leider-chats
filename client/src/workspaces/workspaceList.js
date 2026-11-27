const byName = (a, b) =>
  String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });

// Sidebar groups: one per chat (first-seen order), workspaces sorted by name.
// `query` keeps workspaces whose name, or whose chat's name, contains it.
export function groupWorkspaces(workspaces, query = "") {
  const needle = String(query || "").trim().toLowerCase();
  const matches = (text) => String(text || "").toLowerCase().includes(needle);
  const byChat = new Map();
  for (const workspace of workspaces || []) {
    const key = String(workspace.chatRoomId);
    if (!byChat.has(key)) {
      byChat.set(key, { chatRoomId: key, chatName: workspace.chatName, workspaces: [] });
    }
    if (!needle || matches(workspace.name) || matches(workspace.chatName)) {
      byChat.get(key).workspaces.push(workspace);
    }
  }
  return [...byChat.values()]
    .filter((group) => group.workspaces.length)
    .map((group) => ({ ...group, workspaces: [...group.workspaces].sort(byName) }));
}
