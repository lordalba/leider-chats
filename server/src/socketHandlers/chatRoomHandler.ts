import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import Message from "../models/chatrooms/Message";
import User from "../models/User";
import ChatRoom from "../models/chatrooms/ChatRoom";
import { notifyChatParticipants } from "./notifyChatParticipants";
import { cascadeDeleteChatWorkspaces, evictUserFromChatWorkspaces } from "./workspaces/revoke";
import { deleteChatRoom, exitChatRoom, patchAdminPermissions, removeUserFromChat, updateUserAdminInChat } from "../services/ChatRoomService";

const usersInChatRooms: { [chatroomId: string]: Set<string> } = {};

const chatRoomHandler = (io: Server, socket: Socket) => {
  socket.on("joinRoom", async (prevChatroomId, chatroomId, userId) => {
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
    const emitData = {
      chatRoomId: chatroomId,
      newAdminPermissions: newAdminPermissions,
    };
    await notifyChatParticipants(io, chatroomId, "update-admin-permissions", emitData);
    await patchAdminPermissions(new mongoose.Types.ObjectId(chatroomId), newAdminPermissions);
  });

  socket.on("updateUserAdminStatus", async (chatroomId, userId, updateToAdmin) => {
    const emitData = {
      chatRoomId: chatroomId,
      userId,
      updateToAdmin
    };
    await notifyChatParticipants(io, chatroomId, "update-user-chat-admin", emitData);
    await updateUserAdminInChat(new mongoose.Types.ObjectId(chatroomId), new mongoose.Types.ObjectId(userId), updateToAdmin);
  });

  socket.on("removeParticipantFromChat", async (chatRoomId, userId, removedUserName, removerName) => {
    const emitData = {
      chatRoomId,
      userId
    };
    const systemExitMessage = await removeUserFromChat(new mongoose.Types.ObjectId(chatRoomId), new mongoose.Types.ObjectId(userId), removedUserName, removerName);
    io.to(chatRoomId).emit("newMessage", systemExitMessage);
    await notifyChatParticipants(io, chatRoomId, "remove-user-from-chat", emitData);
    await runWorkspaceCleanup("removeParticipantFromChat", () =>
      evictUserFromChatWorkspaces(io, String(chatRoomId), String(userId))
    );
  });

  socket.on("createdChatroom", async (chatroomId) => {
    await notifyChatParticipants(io, chatroomId, "chatroom-created", null);
  });

  socket.on("deleteRoom", async (chatRoomId, userId) => {
    const emitData = {chatRoomId, deleter: userId}
    await notifyChatParticipants(io, chatRoomId, "roomDeleted", emitData);
    await deleteChatRoom(new mongoose.Types.ObjectId(chatRoomId));
    await runWorkspaceCleanup("deleteRoom", () => cascadeDeleteChatWorkspaces(io, String(chatRoomId)));
    console.log("chatroom was deleted by: " + JSON.stringify(userId))
  });

  socket.on("exitRoom", async (chatRoomId, userId, participantName) => {
    const systemExitMessage = await exitChatRoom(new mongoose.Types.ObjectId(chatRoomId), userId, participantName);
    io.to(chatRoomId).emit("newMessage", systemExitMessage);

    const emitData = {chatRoomId, userId}
    await notifyChatParticipants(io, chatRoomId, "userExitedChatroom", emitData);
    await runWorkspaceCleanup("exitRoom", async () => {
      // exitChatRoom deletes the chat when its last participant leaves.
      const chatStillExists = await ChatRoom.exists({ _id: chatRoomId });
      if (chatStillExists) {
        await evictUserFromChatWorkspaces(io, String(chatRoomId), String(userId));
      } else {
        await cascadeDeleteChatWorkspaces(io, String(chatRoomId));
      }
    });
  });

  socket.on("createdChatroom", async (chatroomId) => {
    await notifyChatParticipants(io, chatroomId, "chatroom-created", null);
  });
};

/** Workspace side effects of chat changes must never break the chat flow. */
const runWorkspaceCleanup = async (label: string, fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    console.error(`[workspaces] cleanup after ${label} failed:`, err);
  }
};

export default chatRoomHandler;
export { usersInChatRooms };
