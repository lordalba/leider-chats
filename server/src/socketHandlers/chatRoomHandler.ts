import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import Message from "../models/chatrooms/Message";
import User from "../models/User";
import ChatRoom from "../models/chatrooms/ChatRoom";
import { notifyChatParticipants } from "./notifyChatParticipants";
import { cascadeDeleteChatWorkspaces, evictUserFromChatWorkspaces } from "../services/workspaces/WorkspaceService";
import { toObjectId } from "../services/workspaces/WorkspaceAccess";
import { isAuthenticatedChatAdmin, isAuthenticatedChatParticipant } from "./chatAuth";
import { deleteChatRoom, exitChatRoom, patchAdminPermissions, removeUserFromChat, updateUserAdminInChat } from "../services/ChatRoomService";

const usersInChatRooms: { [chatroomId: string]: Set<string> } = {};

const chatRoomHandler = (io: Server, socket: Socket) => {
  socket.on("joinRoom", async (prevChatroomId, chatroomId, userId) => {
    if (
      !socket.data.userId ||
      String(socket.data.userId) !== String(userId) ||
      !(await isAuthenticatedChatParticipant(socket, chatroomId))
    ) {
      console.warn(`joinRoom refused for socket ${socket.id}: not a participant or userId mismatch`);
      return;
    }
    const userIdAsObjectId = new mongoose.Types.ObjectId(userId);
    
    if (!usersInChatRooms[chatroomId]) {
      usersInChatRooms[chatroomId] = new Set();
    }

    usersInChatRooms[chatroomId].add(userId);

    if (prevChatroomId && usersInChatRooms[prevChatroomId]) {
      usersInChatRooms[prevChatroomId].delete(userId);
      socket.leave(prevChatroomId);
    }

    console.log(`User ${socket.id} joined chatroom ${chatroomId}`);
    socket.join(chatroomId);

    await Message.updateMany(
      { chatRoomId: chatroomId, seenBy: { $ne: userIdAsObjectId } },
      { $addToSet: { seenBy: userIdAsObjectId } }
    );

    const user = await User.findById(userIdAsObjectId);

    io.to(chatroomId).emit("messagesMarkedAsRead", { chatroomId, user });
  });

  socket.on("leaveRoom", (chatRoomId, userId) => {
    if (usersInChatRooms[chatRoomId]) {
      usersInChatRooms[chatRoomId].delete(userId);
      socket.leave(chatRoomId);

      if (usersInChatRooms[chatRoomId].size === 0) {
        delete usersInChatRooms[chatRoomId];
      }

      console.log(`User ${userId} left chatroom ${chatRoomId}`);
    }
  });

  socket.on("updateAdminPermissions", async (chatroomId, newAdminPermissions) => {
    if (typeof newAdminPermissions !== "boolean" || !(await isAuthenticatedChatAdmin(socket, chatroomId))) {
      console.warn(`updateAdminPermissions refused for socket ${socket.id}: not a chat admin or invalid value`);
      return;
    }
    const emitData = {
      chatRoomId: chatroomId,
      newAdminPermissions: newAdminPermissions,
    };
    await notifyChatParticipants(io, chatroomId, "update-admin-permissions", emitData);
    await patchAdminPermissions(new mongoose.Types.ObjectId(chatroomId), newAdminPermissions);
  });

  socket.on("updateUserAdminStatus", async (chatroomId, userId, updateToAdmin) => {
    if (
      !(await isAuthenticatedChatAdmin(socket, chatroomId)) ||
      !(await isParticipantOf(chatroomId, userId))
    ) {
      console.warn(`updateUserAdminStatus refused for socket ${socket.id}: not a chat admin or target not a participant`);
      return;
    }
    const emitData = {
      chatRoomId: chatroomId,
      userId,
      updateToAdmin
    };
    await notifyChatParticipants(io, chatroomId, "update-user-chat-admin", emitData);
    await updateUserAdminInChat(new mongoose.Types.ObjectId(chatroomId), new mongoose.Types.ObjectId(userId), updateToAdmin);
  });

  socket.on("removeParticipantFromChat", async (chatRoomId, userId, removedUserName, removerName) => {
    if (!(await isAuthenticatedChatAdmin(socket, chatRoomId))) {
      console.warn(`removeParticipantFromChat refused for socket ${socket.id}: not a chat admin`);
      return;
    }
    const emitData = {
      chatRoomId,
      userId
    };
    const systemExitMessage = await removeUserFromChat(new mongoose.Types.ObjectId(chatRoomId), new mongoose.Types.ObjectId(userId), removedUserName, removerName);
    io.to(chatRoomId).emit("newMessage", systemExitMessage);
    await notifyChatParticipants(io, chatRoomId, "remove-user-from-chat", emitData);
    await runWorkspaceCleanup(() => evictUserFromChatWorkspaces(io, chatRoomId, String(userId)));
  });

  socket.on("createdChatroom", async (chatroomId) => {
    await notifyChatParticipants(io, chatroomId, "chatroom-created", null);
  });

  socket.on("deleteRoom", async (chatRoomId, userId) => {
    if (!(await isAuthenticatedChatAdmin(socket, chatRoomId))) {
      console.warn(`deleteRoom refused for socket ${socket.id}: not a chat admin`);
      return;
    }
    const emitData = {chatRoomId, deleter: userId}
    await notifyChatParticipants(io, chatRoomId, "roomDeleted", emitData);
    await deleteChatRoom(new mongoose.Types.ObjectId(chatRoomId));
    await runWorkspaceCleanup(() => cascadeDeleteChatWorkspaces(io, chatRoomId));
    console.log("chatroom was deleted by: " + JSON.stringify(userId))
  });

  socket.on("exitRoom", async (chatRoomId, userId, participantName) => {
    const authUserId = socket.data.userId;
    if (!authUserId || String(authUserId) !== String(userId)) {
      console.warn(`exitRoom refused for socket ${socket.id}: userId does not match the authenticated user`);
      return;
    }
    const systemExitMessage = await exitChatRoom(new mongoose.Types.ObjectId(chatRoomId), userId, participantName);
    io.to(chatRoomId).emit("newMessage", systemExitMessage);

    const emitData = {chatRoomId, userId}
    await notifyChatParticipants(io, chatRoomId, "userExitedChatroom", emitData);

    await runWorkspaceCleanup(async () => {
      await evictUserFromChatWorkspaces(io, chatRoomId, String(userId));
      // exitChatRoom deletes the chat once its last participant leaves.
      if (!(await ChatRoom.exists({ _id: chatRoomId }))) {
        await cascadeDeleteChatWorkspaces(io, chatRoomId);
      }
    });
  });

  socket.on("createdChatroom", async (chatroomId) => {
    await notifyChatParticipants(io, chatroomId, "chatroom-created", null);
  });
};

const isParticipantOf = async (chatRoomId: unknown, userId: unknown): Promise<boolean> => {
  try {
    const chat = await ChatRoom.findById(toObjectId(chatRoomId));
    return !!chat && chat.participants.some((p) => String(p) === String(userId));
  } catch (error) {
    return false;
  }
};

// Workspace side effects of chat changes must never crash the socket handler.
const runWorkspaceCleanup = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    console.error("workspace cleanup failed", error);
  }
};

export default chatRoomHandler;
export { usersInChatRooms };
