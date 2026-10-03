import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { saveChatMessage } from "../services/ChatRoomService";
import { usersInChatRooms } from "./chatRoomHandler";
import { OnlineUserService } from "../services/OnlineUserService";
import ChatRoom from "../models/chatrooms/ChatRoom";

const messageHandler = (io: Server, socket: Socket) => {
  socket.on("sendMessage", async (message) => {
    const { chatRoomId, senderId, content, type, fileName, mediaUrl } = message;

    const messageToSend = await saveChatMessage(
      chatRoomId,
      senderId,
      content,
      type,
      fileName,
      mediaUrl
    );

    if (messageToSend) {
      const currentUsersInRoom = usersInChatRooms[chatRoomId] || new Set();
      const objectIdArray = Array.from(
        currentUsersInRoom,
        (userId) => new mongoose.Types.ObjectId(userId)
      );

      messageToSend.seenBy = Array.from(objectIdArray);
      await messageToSend.save();
      await messageToSend.populate("seenBy", "username profilePictureUrl");

      io.to(chatRoomId).emit("newMessage", messageToSend);

      await handleUpdatingAllOnlineUsers(chatRoomId, senderId, io);
    }
  });

  socket.on("typing", (data) => {
    const { chatroomId, userId, username } = data;
    io.to(chatroomId).emit("friendTyping", { chatroomId, userId, username });
  });
};

const handleUpdatingAllOnlineUsers = async (
  chatroomId: string,
  senderId: string,
  io: Server
) => {
  const allChatroomUsers = await ChatRoom.findById(chatroomId);

  if (allChatroomUsers) {
    const onlineUsers = allChatroomUsers.participants.filter((userId) =>
      OnlineUserService.isUserOnline(String(userId))
    );

    if (onlineUsers) {
      onlineUsers.forEach((userId) => {
        const socketIds = OnlineUserService.getUserSockets(String(userId));
        if (socketIds) {
          socketIds.forEach((socketId) => {
            io.to(socketId).emit("newChatMessage", {
              chatRoomId: chatroomId,
              senderId,
            });
          });
        }
      });
    }
  }
};

export default messageHandler;
