import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import Message from "../models/chatrooms/Message";
import User from "../models/User";
import ChatRoom from "../models/chatrooms/ChatRoom";
import IChatRoom from "../types/chatrooms/IChatRoom";
import { notifyChatParticipants } from "./notifyChatParticipants";
import { cascadeDeleteChatWorkspaces, evictUserFromChatWorkspaces } from "./workspaces/revoke";
import {
  deleteChatRoom,
  exitChatRoom,
  patchAdminPermissions,
  removeUserFromChat,
  updateUserAdminInChat,
} from "../services/ChatRoomService";
import { isChatAdmin, isChatParticipant } from "../services/workspaces/WorkspaceAccess";

/** Who currently has each chat open (used to mark new messages as seen). */
const usersInChatRooms: { [chatroomId: string]: Set<string> } = {};

class ChatActionError extends Error {}

/** The logged-in user of this socket (from its JWT). Chat actions never trust a user id sent by the client. */
const actorOf = (socket: Socket): string => {
  const userId = socket.data && socket.data.userId;
  if (typeof userId !== "string") throw new ChatActionError("not logged in");
  return userId;
};

const loadChat = async (chatRoomId: unknown): Promise<IChatRoom> => {
  if (typeof chatRoomId !== "string" || !mongoose.isValidObjectId(chatRoomId)) {
    throw new ChatActionError("invalid chat id");
  }
  const chat = await ChatRoom.findById(chatRoomId);
  if (!chat) throw new ChatActionError("chat not found");
  return chat;
};

const requireMember = (chat: IChatRoom, userId: string) => {
  if (!isChatParticipant(chat, userId)) throw new ChatActionError("not a member of this chat");
};

const requireAdmin = (chat: IChatRoom, userId: string) => {
  requireMember(chat, userId);
  if (!isChatAdmin(chat, userId)) throw new ChatActionError("only admins can do that");
};

const usernameOf = async (userId: string): Promise<string> => {
  const user = await User.findById(userId).select("username");
  return user ? user.username : "Someone";
};

/**
 * Wraps a socket event handler: expected problems (not allowed, bad ids) are logged quietly,
 * anything unexpected is logged as an error. Either way the server keeps running.
 */
const safely =
  <A extends unknown[]>(event: string, handler: (...args: A) => Promise<void> | void) =>
  async (...args: A): Promise<void> => {
    try {
      await handler(...args);
    } catch (error) {
      if (error instanceof ChatActionError) console.warn(`[chat] ${event} rejected: ${error.message}`);
      else console.error(`[chat] ${event} failed:`, error);
    }
  };

/** Workspace side effects of chat changes must never break the chat flow. */
const runWorkspaceCleanup = async (label: string, fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    console.error(`[workspaces] cleanup after ${label} failed:`, err);
  }
};

const chatRoomHandler = (io: Server, socket: Socket) => {
  socket.on(
    "joinRoom",
    safely("joinRoom", async (prevChatroomId: unknown, chatroomId: unknown) => {
      const userId = actorOf(socket);
      const chat = await loadChat(chatroomId);
      requireMember(chat, userId);
      const chatId = String(chat._id);

      if (typeof prevChatroomId === "string" && usersInChatRooms[prevChatroomId]) {
        usersInChatRooms[prevChatroomId].delete(userId);
        socket.leave(prevChatroomId);
      }
      if (!usersInChatRooms[chatId]) usersInChatRooms[chatId] = new Set();
      usersInChatRooms[chatId].add(userId);
      socket.join(chatId);

      const userObjectId = new mongoose.Types.ObjectId(userId);
      await Message.updateMany(
        { chatRoomId: chat._id, seenBy: { $ne: userObjectId } },
        { $addToSet: { seenBy: userObjectId } }
      );
      const user = await User.findById(userObjectId).select("username profilePictureUrl");
      io.to(chatId).emit("messagesMarkedAsRead", { chatroomId: chatId, user });
    })
  );

  socket.on(
    "leaveRoom",
    safely("leaveRoom", (chatRoomId: unknown) => {
      const userId = actorOf(socket);
      if (typeof chatRoomId !== "string" || !usersInChatRooms[chatRoomId]) return;
      usersInChatRooms[chatRoomId].delete(userId);
      socket.leave(chatRoomId);
      if (usersInChatRooms[chatRoomId].size === 0) delete usersInChatRooms[chatRoomId];
    })
  );

  /** "Only admins can send messages" switch. */
  socket.on(
    "updateAdminPermissions",
    safely("updateAdminPermissions", async (chatroomId: unknown, adminsOnly: unknown) => {
      const chat = await loadChat(chatroomId);
      requireAdmin(chat, actorOf(socket));
      const value = adminsOnly === true;
      await patchAdminPermissions(chat._id as mongoose.Types.ObjectId, value);
      await notifyChatParticipants(io, String(chat._id), "update-admin-permissions", {
        chatRoomId: String(chat._id),
        newAdminPermissions: value,
      });
    })
  );

  socket.on(
    "updateUserAdminStatus",
    safely("updateUserAdminStatus", async (chatroomId: unknown, targetUserId: unknown, makeAdmin: unknown) => {
      const chat = await loadChat(chatroomId);
      requireAdmin(chat, actorOf(socket));
      if (typeof targetUserId !== "string" || !isChatParticipant(chat, targetUserId)) {
        throw new ChatActionError("that user is not in this chat");
      }
      const updateToAdmin = makeAdmin === true;
      await updateUserAdminInChat(
        chat._id as mongoose.Types.ObjectId,
        new mongoose.Types.ObjectId(targetUserId),
        updateToAdmin
      );
      await notifyChatParticipants(io, String(chat._id), "update-user-chat-admin", {
        chatRoomId: String(chat._id),
        userId: targetUserId,
        updateToAdmin,
      });
    })
  );

  socket.on(
    "removeParticipantFromChat",
    safely("removeParticipantFromChat", async (chatroomId: unknown, targetUserId: unknown) => {
      const actorId = actorOf(socket);
      const chat = await loadChat(chatroomId);
      requireAdmin(chat, actorId);
      if (typeof targetUserId !== "string" || !isChatParticipant(chat, targetUserId)) {
        throw new ChatActionError("that user is not in this chat");
      }
      const chatId = String(chat._id);
      // Notify while the removed user is still a participant, so they hear about it too.
      await notifyChatParticipants(io, chatId, "remove-user-from-chat", { chatRoomId: chatId, userId: targetUserId });
      const systemMessage = await removeUserFromChat(
        chat._id as mongoose.Types.ObjectId,
        new mongoose.Types.ObjectId(targetUserId),
        await usernameOf(targetUserId),
        await usernameOf(actorId)
      );
      io.to(chatId).emit("newMessage", systemMessage);
      await runWorkspaceCleanup("removeParticipantFromChat", () =>
        evictUserFromChatWorkspaces(io, chatId, targetUserId)
      );
    })
  );

  /** Tells the members of a newly created chat to refresh their chat list. */
  socket.on(
    "createdChatroom",
    safely("createdChatroom", async (chatroomId: unknown) => {
      const chat = await loadChat(chatroomId);
      requireMember(chat, actorOf(socket));
      await notifyChatParticipants(io, String(chat._id), "chatroom-created", null);
    })
  );

  socket.on(
    "deleteRoom",
    safely("deleteRoom", async (chatroomId: unknown) => {
      const actorId = actorOf(socket);
      const chat = await loadChat(chatroomId);
      requireAdmin(chat, actorId);
      const chatId = String(chat._id);
      await notifyChatParticipants(io, chatId, "roomDeleted", { chatRoomId: chatId, deleter: actorId });
      await runWorkspaceCleanup("deleteRoom", () => cascadeDeleteChatWorkspaces(io, chatId));
      await deleteChatRoom(chat._id as mongoose.Types.ObjectId);
    })
  );

  socket.on(
    "exitRoom",
    safely("exitRoom", async (chatroomId: unknown) => {
      const userId = actorOf(socket);
      const chat = await loadChat(chatroomId);
      requireMember(chat, userId);
      const chatId = String(chat._id);

      const systemMessage = await exitChatRoom(
        chat._id as mongoose.Types.ObjectId,
        new mongoose.Types.ObjectId(userId),
        await usernameOf(userId)
      );
      // null when the last member left and the chat was deleted.
      if (systemMessage) io.to(chatId).emit("newMessage", systemMessage);
      await notifyChatParticipants(io, chatId, "userExitedChatroom", { chatRoomId: chatId, userId });
      await runWorkspaceCleanup("exitRoom", async () => {
        // exitChatRoom deletes the chat when its last participant leaves.
        if (await ChatRoom.exists({ _id: chat._id })) {
          await evictUserFromChatWorkspaces(io, chatId, userId);
        } else {
          await cascadeDeleteChatWorkspaces(io, chatId);
        }
      });
    })
  );
};

export default chatRoomHandler;
export { usersInChatRooms };
