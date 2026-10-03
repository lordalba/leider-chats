import User from "../models/User";
import { Server } from "socket.io";
import { OnlineUserService } from "./OnlineUserService";

export const notifyFriendsOnlineStatus = async (
  userId: string,
  isOnline: boolean,
  io: Server
) => {
  console.log(`Notifying friends of user ${userId} (isOnline: ${isOnline})`);

  const user = await User.findById(userId).populate(
    "friends",
    "username profilePictureUrl"
  );

  user?.friends.forEach((friend) => {
    const friendSocketIds = OnlineUserService.getUserSockets(String(friend._id));

    if (friendSocketIds) {
      friendSocketIds.forEach((socketId) => {
        io.to(socketId).emit("friendStatusUpdate", {
          id: userId,
          online: isOnline,
        });
      });
    }
  });
};

export const disconnectFromChat = (userId: string) => {
  const { usersInChatRooms } = require("../socketHandlers/chatRoomHandler");
  for (const chatroomId in usersInChatRooms) {
    usersInChatRooms[chatroomId].delete(userId);
    console.log("deleted successfully from " + chatroomId)
    if (usersInChatRooms[chatroomId].size === 0) {
      delete usersInChatRooms[chatroomId];
    }
  }
};
