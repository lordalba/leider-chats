/** The other person in a one-on-one chat (participants must be populated). */
export function otherParticipant(chatroom, myId) {
  return ((chatroom && chatroom.participants) || []).find((p) => p && String(p._id) !== String(myId)) || null;
}

/** Group chats use their name; one-on-one chats are named after the other person. */
export function chatDisplayName(chatroom, myId) {
  if (!chatroom) return "";
  if (chatroom.isGroupChat) return chatroom.name || "Group chat";
  const other = otherParticipant(chatroom, myId);
  return (other && other.username) || chatroom.name || "Chat";
}

/** The picture to show for a chat: the group picture, or the other person's profile picture. */
export function chatPicture(chatroom, myId) {
  if (!chatroom) return "";
  if (chatroom.isGroupChat) return chatroom.imageUrl || "";
  const other = otherParticipant(chatroom, myId);
  return (other && other.profilePictureUrl) || "";
}
