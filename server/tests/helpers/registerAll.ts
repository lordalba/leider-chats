import { Server, Socket } from "socket.io";
import connectionHandler from "../../src/socketHandlers/connectionHandler";
import chatRoomHandler from "../../src/socketHandlers/chatRoomHandler";
import workspaceHandler from "../../src/socketHandlers/workspaces/workspaceHandler";
import taskHandler from "../../src/socketHandlers/workspaces/taskHandler";
import documentHandler from "../../src/socketHandlers/workspaces/documentHandler";
import whiteboardHandler from "../../src/socketHandlers/workspaces/whiteboardHandler";

/** Registers the same handlers as the real server (minus chat messages). */
export const registerAll = (io: Server, socket: Socket): void => {
  connectionHandler(io, socket);
  chatRoomHandler(io, socket);
  workspaceHandler(io, socket);
  taskHandler(io, socket);
  documentHandler(io, socket);
  whiteboardHandler(io, socket);
};

export const quietLogs = () => {
  const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  return () => log.mockRestore();
};
