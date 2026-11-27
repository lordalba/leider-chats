// Options for the "Group chat" picker when creating a workspace. Workspaces
// belong to group chats only.
export function groupChatOptions(chats) {
  return (chats || [])
    .filter((chat) => chat && chat.isGroupChat)
    .map((chat) => ({ value: String(chat._id), text: chat.name || "Unnamed group" }))
    .sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: "base" }));
}
