import ChatRoom from "../models/chatrooms/ChatRoom";
import Message from "../models/chatrooms/Message";
import IMessage from "../types/chatrooms/IMessage";
import IChatRoom from "../types/chatrooms/IChatRoom";
import mongoose from "mongoose";

/** A group whose last admin left gets a new admin: the longest-standing member. */
const ensureGroupHasAdmin = async (chat: IChatRoom): Promise<void> => {
  if (!chat.isGroupChat || chat.admins.length > 0 || chat.participants.length === 0) return;
  await ChatRoom.updateOne({ _id: chat._id }, { $addToSet: { admins: chat.participants[0] } });
};

export const createChatRoom = async (
  participantIds: mongoose.Types.ObjectId[],
  name: string | null,
  imageUrl: string | null,
  chatCreatorId: mongoose.Types.ObjectId
): Promise<IChatRoom> => {
  const isGroupChat = participantIds.length > 2 ? true : false;

  const chatRoom = new ChatRoom({
    participants: participantIds,
    ...(name && { name }),
    ...(imageUrl && { imageUrl }),
    isGroupChat: isGroupChat,
    admins: [chatCreatorId],
  });

  await chatRoom.save();

  return chatRoom;
};

/** The private chat between two users, created if it doesn't exist yet. */
export const findOrCreateDirectChat = async (
  userId: mongoose.Types.ObjectId,
  otherUserId: mongoose.Types.ObjectId
): Promise<IChatRoom> => {
  const existing = await ChatRoom.findOne({
    isGroupChat: false,
    participants: { $all: [userId, otherUserId], $size: 2 },
  });
  return existing || createChatRoom([userId, otherUserId], null, null, userId);
};

export const fetchUserChats = async (
  userId: mongoose.Types.ObjectId
): Promise<IChatRoom[]> => {
  const userChatRooms = await ChatRoom.find({
    participants: userId,
  })
    .populate(
      "participants",
      "username profilePictureUrl lastConnected age profession location"
    )
    .sort({ updatedAt: -1 }) // Sort by most recent activity
    .exec();

  return userChatRooms;
};

export const fetchUsersRelatedChats = async (
  userId: mongoose.Types.ObjectId,
  otherId: mongoose.Types.ObjectId
): Promise<IChatRoom[]> => {
  const userChatRooms = await ChatRoom.find({
    participants: { $all: [userId, otherId] },
    $expr: { $gt: [{ $size: "$participants" }, 2] },
  })
    .select("name imageUrl")
    .exec();

  return userChatRooms;
};

export const fetchChatMessages = async (
  chatRoomId: mongoose.Types.ObjectId,
  limit: number = 200
): Promise<IMessage[]> => {
  // Take the newest messages, then return them oldest-first for display.
  const messages = await Message.find({ chatRoomId })
    .populate("senderId", "username profilePictureUrl")
    .populate("seenBy", "username profilePictureUrl")
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();

  return messages.reverse();
};


export const patchAdminPermissions = async (
  chatRoomId: mongoose.Types.ObjectId,
  newAdminPerssions: boolean
) => {
  await ChatRoom.findByIdAndUpdate(chatRoomId, {
    adminPermissions: newAdminPerssions,
  });
};

export const updateUserAdminInChat = async (
  chatRoomId: mongoose.Types.ObjectId,
  participantId: mongoose.Types.ObjectId,
  updateToAdmin: boolean
) => {
  updateToAdmin
    ? await ChatRoom.findByIdAndUpdate(
        chatRoomId,
        { $addToSet: { admins: participantId } },
        { new: true }
      )
    : await ChatRoom.findByIdAndUpdate(
        chatRoomId,
        { $pull: { admins: participantId } },
        { new: true }
      );
};

export const removeUserFromChat = async (
  chatRoomId: mongoose.Types.ObjectId,
  participantId: mongoose.Types.ObjectId,
  removedUserName: string,
  removerName: string
) => {
  const updatedChatRoom = await ChatRoom.findByIdAndUpdate(
    chatRoomId,
    { $pull: { participants: participantId, admins: participantId } },
    { new: true }
  );
  if (updatedChatRoom) await ensureGroupHasAdmin(updatedChatRoom);

  const message = new Message({
    chatRoomId,
    content: `${removedUserName} was removed by ${removerName}.`,
    type: "system",
  });

  await message.save();

  return message;
};

export const saveChatMessage = async (
  chatRoomId: mongoose.Types.ObjectId,
  senderId: mongoose.Types.ObjectId,
  content: string,
  type: string,
  fileName: string,
  mediaUrl: string
): Promise<IMessage> => {
  const message = new Message({
    chatRoomId: chatRoomId,
    senderId: senderId,
    content: content,
    seenBy: [senderId],
    type: type,
    fileName: fileName,
    mediaUrl: mediaUrl,
  });

  await message.save();

  await ChatRoom.findByIdAndUpdate(chatRoomId, {
    lastMessage: {
      content:
        content ||
        (type === "image" ? "🖼️ Photo" : type === "voice" ? "🎤 Voice message" : `📎 ${fileName || "File"}`),
      timestamp: message.timestamp,
    },
  });

  return message.populate("senderId", "username profilePictureUrl");
};

export const fetchUnreadMessagesCount = async (
  chatRoomId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<Number> => {
  const unreadMessagesCount = await Message.countDocuments({
    chatRoomId,
    seenBy: { $ne: userId },
  });

  return unreadMessagesCount;
};

/** Deletes the chat and all of its messages. */
export const deleteChatRoom = async (chatRoomId: mongoose.Types.ObjectId) => {
  await Message.deleteMany({ chatRoomId });
  await ChatRoom.deleteOne({ _id: chatRoomId });
};

export const exitChatRoom = async (
  chatRoomId: mongoose.Types.ObjectId,
  participantId: mongoose.Types.ObjectId,
  participantName: string
) => {
  const updatedChatRoom = await ChatRoom.findByIdAndUpdate(
    chatRoomId,
    { $pull: { participants: participantId, admins: participantId } },
    { new: true }
  );
  if (updatedChatRoom) await ensureGroupHasAdmin(updatedChatRoom);

  // The last person left: remove the chat entirely.
  if (updatedChatRoom && updatedChatRoom.participants.length === 0) {
    await deleteChatRoom(chatRoomId);
    return null;
  }

  const message = new Message({
    chatRoomId,
    content: `${participantName} has left the chatroom.`,
    type: "system",
  });

  await message.save();

  return message;
};

