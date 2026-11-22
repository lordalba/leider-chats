import { Server } from "socket.io";
import connectionHandler from "./connectionHandler";
import chatRoomHandler from "./chatRoomHandler";
import messageHandler from "./messageHandler";
import workspaceHandler from "./workspaces/workspaceHandler";
import taskHandler from "./workspaces/taskHandler";
import documentHandler from "./workspaces/documentHandler";

const socketHandlers = (io: Server) => {
  io.on("connection", (socket) => {
    connectionHandler(io, socket);
    chatRoomHandler(io, socket);
    messageHandler(io, socket);
    workspaceHandler(io, socket);
    taskHandler(io, socket);
    documentHandler(io, socket);
  });
};

export default socketHandlers;
