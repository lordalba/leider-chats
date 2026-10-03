import { Server } from "socket.io";
import connectionHandler from "./connectionHandler";
import chatRoomHandler from "./chatRoomHandler";
import messageHandler from "./messageHandler";

const socketHandlers = (io: Server) => {
  io.on("connection", (socket) => {
    connectionHandler(io, socket);
    chatRoomHandler(io, socket);
    messageHandler(io, socket);
  });
};

export default socketHandlers;
