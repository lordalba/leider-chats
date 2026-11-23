import { Response } from "express";
import mongoose from "mongoose";
import { MyUserRequest } from "../../types/express";
import ChatRoom from "../../models/chatrooms/ChatRoom";
import { asyncHandler } from "../../http/asyncHandler";
import { HttpError } from "../../http/HttpError";
import { DEFAULT_GROUP_IMAGE, moveUpload, uniqueFileName } from "../../utils/files";
import {
  createChatRoom,
  fetchChatMessages,
  fetchUnreadMessagesCount,
  fetchUserChats,
  fetchUsersRelatedChats,
  findOrCreateDirectChat,
} from "../../services/ChatRoomService";

const MAX_GROUP_NAME_LENGTH = 80;

const objectId = (id: unknown, what: string): mongoose.Types.ObjectId => {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) throw HttpError.notFound(`${what} not found.`);
  return new mongoose.Types.ObjectId(id);
};

/** Loads the chat id from the URL and checks the user is in it. */
const requireParticipant = async (req: MyUserRequest): Promise<mongoose.Types.ObjectId> => {
  const chatRoomId = objectId(req.params.chatRoomId, "Chat");
  const isMember = await ChatRoom.exists({ _id: chatRoomId, participants: objectId(req.userId, "User") });
  if (!isMember) throw HttpError.forbidden("You are not in this chat.");
  return chatRoomId;
};

/** All of the user's chats with their unread counts. */
export const getUserChats = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  const userId = objectId(req.userId, "User");
  const chats = await fetchUserChats(userId);
  const withUnread = await Promise.all(
    chats.map(async (chat) => ({
      ...chat.toObject(),
      unreadMessages: await fetchUnreadMessagesCount(chat._id as mongoose.Types.ObjectId, userId),
    }))
  );
  res.status(200).json(withUnread);
});

export const getChatMessages = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  const chatRoomId = await requireParticipant(req);
  res.status(200).json(await fetchChatMessages(chatRoomId));
});

/** Group chats that both the user and this friend are in. */
export const getRelatedChatroomsWithFriend = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  const related = await fetchUsersRelatedChats(objectId(req.userId, "User"), objectId(req.params.friendId, "User"));
  res.status(200).json(related);
});

/**
 * One other person: their private chat (reused if it exists).
 * Two or more: a new group, with an optional picture (the default group picture otherwise).
 */
export const createChatroom = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  const creatorId = objectId(req.userId, "User");

  let others: string[];
  try {
    others = Array.from(new Set((JSON.parse(req.body.participants) as unknown[]).map(String)));
  } catch {
    throw HttpError.badRequest("Invalid participants.");
  }
  others = others.filter((id) => id !== String(creatorId));
  if (others.length === 0) throw HttpError.badRequest("Pick at least one friend.");
  const otherIds = others.map((id) => objectId(id, "User"));

  if (otherIds.length === 1) {
    res.status(200).json(await findOrCreateDirectChat(creatorId, otherIds[0]));
    return;
  }

  // FormData turns a missing name into the text "null".
  const { name } = req.body;
  const cleanName = typeof name === "string" && name.trim() && name !== "null" ? name.trim().slice(0, MAX_GROUP_NAME_LENGTH) : "New group";
  const imageUrl = req.file
    ? await moveUpload(req.file.path, "chatrooms", uniqueFileName(req.file.originalname))
    : DEFAULT_GROUP_IMAGE();

  const chat = await createChatRoom([creatorId, ...otherIds], cleanName, imageUrl, creatorId);
  res.status(200).json(chat);
});
