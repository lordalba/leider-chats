import { Server } from "socket.io";
import ChatRoom from "../models/chatrooms/ChatRoom";
import { OnlineUserService } from "../services/OnlineUserService";

/** Emits `emitName` to every socket of every online participant of the chat. */
export const notifyChatParticipants = async (
  io: Server,
  chatroomId: string,
  emitName: string,
  emitData: Object | null
): Promise<void> => {
  const chatroom = await ChatRoom.findById(chatroomId);
  if (!chatroom) return;

  chatroom.participants
    .filter((userId) => OnlineUserService.isUserOnline(String(userId)))
    .forEach((userId) => {
      const socketIds = OnlineUserService.getUserSockets(String(userId)) || [];
      socketIds.forEach((socketId) => {
        emitData ? io.to(socketId).emit(emitName, emitData) : io.to(socketId).emit(emitName);
      });
    });
};
