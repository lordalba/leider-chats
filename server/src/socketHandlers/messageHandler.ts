import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { saveChatMessage } from "../services/ChatRoomService";
import { usersInChatRooms } from "./chatRoomHandler";
import { OnlineUserService } from "../services/OnlineUserService";
import ChatRoom from "../models/chatrooms/ChatRoom";

const messageHandler = (io: Server, socket: Socket) => {
  socket.on("sendMessage", async (message) => {
   try {
    if (!message || typeof message !== "object") return;
    const { chatRoomId, content, type, fileName, mediaUrl } = message;
    // Trust the logged-in user over what the browser claims.
    const senderId = socket.data && socket.data.userId ? socket.data.userId : message.senderId;
    if (!mongoose.isValidObjectId(chatRoomId) || !mongoose.isValidObjectId(senderId)) return;
    if (!(await ChatRoom.exists({ _id: chatRoomId, participants: senderId }))) return;
    const hasText = typeof content === "string" && content.trim().length > 0;
    if (!hasText && !mediaUrl) return;

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
   } catch (error) {
    // A bad message must never take the whole server down.
    console.error("sendMessage failed:", error);
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
