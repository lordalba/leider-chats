import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import Message from "../models/chatrooms/Message";
import ChatRoom from "../models/chatrooms/ChatRoom";
import { withAck } from "./workspaces/withAck";
import { WorkspaceError, isChatAdmin, isChatParticipant, toObjectId } from "../services/workspaces/WorkspaceAccess";
import { notifyChatParticipants } from "./notifyChatParticipants";

const MAX_MESSAGE_LENGTH = 5000;
const MAX_DESCRIPTION_LENGTH = 500;

const loadOwnedMessage = async (messageId: unknown, userId: string, allowChatAdmin: boolean) => {
  const message = await Message.findById(toObjectId(messageId));
  if (!message) throw new WorkspaceError("not_found");
  const chat = await ChatRoom.findById(message.chatRoomId);
  if (!chat || !isChatParticipant(chat, userId)) throw new WorkspaceError("forbidden");

  const isSender = String(message.senderId) === String(userId);
  const adminOverride = allowChatAdmin && chat.isGroupChat && isChatAdmin(chat, userId);
  if (!isSender && !adminOverride) throw new WorkspaceError("forbidden");
  return { message, chat };
};

const broadcastUpdated = async (io: Server, message: InstanceType<typeof Message>) => {
  await message.populate("senderId", "username profilePictureUrl");
  await message.populate("seenBy", "username profilePictureUrl");
  io.to(String(message.chatRoomId)).emit("messageUpdated", message);
};

/** Keeps the chat list preview in sync when the newest message changes. */
const refreshLastMessage = async (chatRoomId: mongoose.Types.ObjectId) => {
  const latest = await Message.findOne({ chatRoomId, type: { $ne: "system" } }).sort({ timestamp: -1 });
  await ChatRoom.updateOne(
    { _id: chatRoomId },
    {
      lastMessage: latest
        ? { content: latest.deleted ? "Message deleted" : latest.content || "📎 Attachment", timestamp: latest.timestamp }
        : null,
    }
  );
};

const messageActionsHandler = (io: Server, socket: Socket) => {
  /** Only the sender can edit, and only text messages. */
  socket.on(
    "editMessage",
    withAck(socket, async (userId, messageId: string, content: unknown) => {
      const { message } = await loadOwnedMessage(messageId, userId, false);
      if (message.deleted || message.type !== "text") throw new WorkspaceError("invalid");
      if (typeof content !== "string") throw new WorkspaceError("invalid");
      const text = content.trim();
      if (!text || text.length > MAX_MESSAGE_LENGTH) throw new WorkspaceError("invalid");

      message.content = text;
      message.editedAt = new Date();
      await message.save();
      await refreshLastMessage(message.chatRoomId);
      await broadcastUpdated(io, message);
      return null;
    })
  );

  /** The sender can delete their message; group admins can delete any message in their group. */
  socket.on(
    "deleteMessage",
    withAck(socket, async (userId, messageId: string) => {
      const { message } = await loadOwnedMessage(messageId, userId, true);
      if (message.type === "system") throw new WorkspaceError("invalid");
      message.deleted = true;
      message.content = "";
      message.set("mediaUrl", null);
      message.set("fileName", null);
      await message.save();
      await refreshLastMessage(message.chatRoomId);
      await broadcastUpdated(io, message);
      return null;
    })
  );

  /** Group description: anyone in the chat can read it, only admins can change it. */
  socket.on(
    "updateChatDescription",
    withAck(socket, async (userId, chatRoomId: string, description: unknown) => {
      const chat = await ChatRoom.findById(toObjectId(chatRoomId));
      if (!chat) throw new WorkspaceError("not_found");
      if (!isChatParticipant(chat, userId) || !isChatAdmin(chat, userId)) throw new WorkspaceError("forbidden");
      if (typeof description !== "string" || description.trim().length > MAX_DESCRIPTION_LENGTH) {
        throw new WorkspaceError("invalid");
      }
      chat.description = description.trim();
      await chat.save();
      await notifyChatParticipants(io, String(chat._id), "chat-description-updated", {
        chatRoomId: String(chat._id),
        description: chat.description,
      });
      return { description: chat.description };
    })
  );
};

export default messageActionsHandler;
