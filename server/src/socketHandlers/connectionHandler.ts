import { Server, Socket } from "socket.io";
import moment from "moment-timezone";
import { OnlineUserService } from "../services/OnlineUserService";
import { notifyFriendsOnlineStatus, disconnectFromChat } from "../services/UserService";
import User from "../models/User";
import { WorkspacePresenceService } from "../services/workspaces/WorkspacePresenceService";
import { yDocManager } from "../services/workspaces/mongoYDocStore";
import { broadcastPresence } from "./workspaces/revoke";

const connectionHandler = (io: Server, socket: Socket) => {
  console.log("A user connected", socket.id);

  socket.on("userOnline", (userId: string) => {
    console.log("User online:", userId);
    OnlineUserService.setUserOnline(userId, socket.id);
    notifyFriendsOnlineStatus(userId, true, io);
  });

  socket.on("disconnect", async () => {
    console.log("A user disconnected", socket.id);

    // Workspace presence and open Yjs docs are keyed by socket.
    WorkspacePresenceService.removeSocket(socket.id).forEach((workspaceId) =>
      broadcastPresence(io, workspaceId)
    );
    yDocManager
      .closeSocket(socket.id)
      .catch((err) => console.error("[ydoc] close on disconnect failed:", err));

    const userId = OnlineUserService.removeUserSocket(socket.id);
    const israelTime = moment().tz("Asia/Jerusalem").toDate();

    if (userId) {
      disconnectFromChat(userId);
      notifyFriendsOnlineStatus(userId, false, io);
      await User.findByIdAndUpdate(userId, { lastConnected: israelTime });
    }
  });
};

export default connectionHandler;
