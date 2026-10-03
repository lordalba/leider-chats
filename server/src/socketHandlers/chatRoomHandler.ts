import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import Message from "../models/chatrooms/Message";
import User from "../models/User";
import ChatRoom from "../models/chatrooms/ChatRoom";
import { OnlineUserService } from "../services/OnlineUserService";
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
    await updateOnlineChatUsers(chatroomId, emitData, "update-admin-permissions", io);
    await patchAdminPermissions(new mongoose.Types.ObjectId(chatroomId), newAdminPermissions);
  });

  socket.on("updateUserAdminStatus", async (chatroomId, userId, updateToAdmin) => {
    const emitData = {
      chatRoomId: chatroomId,
      userId,
      updateToAdmin
    };
    await updateOnlineChatUsers(chatroomId, emitData, "update-user-chat-admin", io);
    await updateUserAdminInChat(new mongoose.Types.ObjectId(chatroomId), new mongoose.Types.ObjectId(userId), updateToAdmin);
  });

  socket.on("removeParticipantFromChat", async (chatRoomId, userId, removedUserName, removerName) => {
    const emitData = {
      chatRoomId,
      userId
    };
    const systemExitMessage = await removeUserFromChat(new mongoose.Types.ObjectId(chatRoomId), new mongoose.Types.ObjectId(userId), removedUserName, removerName);
    io.to(chatRoomId).emit("newMessage", systemExitMessage);
    await updateOnlineChatUsers(chatRoomId, emitData, "remove-user-from-chat", io);
  });

  socket.on("createdChatroom", async (chatroomId) => {
    await updateOnlineChatUsers(chatroomId, null, "chatroom-created", io);
  });

  socket.on("deleteRoom", async (chatRoomId, userId) => {
    const emitData = {chatRoomId, deleter: userId}
    await updateOnlineChatUsers(chatRoomId, emitData, "roomDeleted", io);
    await deleteChatRoom(new mongoose.Types.ObjectId(chatRoomId));
    console.log("chatroom was deleted by: " + JSON.stringify(userId))
  });

  socket.on("exitRoom", async (chatRoomId, userId, participantName) => {
    const systemExitMessage = await exitChatRoom(new mongoose.Types.ObjectId(chatRoomId), userId, participantName);
    io.to(chatRoomId).emit("newMessage", systemExitMessage);

    const emitData = {chatRoomId, userId}
    await updateOnlineChatUsers(chatRoomId, emitData, "userExitedChatroom", io);
  });

  socket.on("createdChatroom", async (chatroomId) => {
    await updateOnlineChatUsers(chatroomId, null, "chatroom-created", io);
  });
};

const updateOnlineChatUsers = async (chatroomId: string, emitData: Object | null, emitName: string, io: Server) => {
  const allChatroomUsers = await ChatRoom.findById(chatroomId);

  if (allChatroomUsers){
    const onlineUsers =  allChatroomUsers.participants.filter((userId) => OnlineUserService.isUserOnline(String(userId)))

    if (onlineUsers){
      onlineUsers.forEach((userId) => {
        const socketIds = OnlineUserService.getUserSockets(String(userId));
        if (socketIds) {
        socketIds.forEach((socketId) => {
          emitData ? io.to(socketId).emit(emitName, emitData) : io.to(socketId).emit(emitName);
        });
      }
      })
    }
  }
};

export default chatRoomHandler;
export { usersInChatRooms };
