import { Server, Socket } from "socket.io";
import moment from "moment-timezone";
import { OnlineUserService } from "../services/OnlineUserService";
import { notifyFriendsOnlineStatus, disconnectFromChat } from "../services/UserService";
import User from "../models/User";
import { WorkspacePresenceService } from "../services/workspaces/WorkspacePresenceService";
import { broadcastPresence } from "../services/workspaces/WorkspaceService";
import { refuseUnauthenticated } from "./chatAuth";

const connectionHandler = (io: Server, socket: Socket) => {
  console.log("A user connected", socket.id);

  socket.on("userOnline", (claimedUserId: unknown) => {
    // Register only the JWT-derived identity; a payload id is never trusted
    // (it would route another user's notifications to this socket).
    if (refuseUnauthenticated(socket, "userOnline")) return;
    const userId = String(socket.data.userId);
    if (claimedUserId !== undefined && String(claimedUserId) !== userId) {
      console.warn(`userOnline refused for socket ${socket.id}: userId does not match the authenticated user`);
      return;
    }
    console.log("User online:", userId);
    OnlineUserService.setUserOnline(userId, socket.id);
    notifyFriendsOnlineStatus(userId, true, io);
  });

  socket.on("disconnect", async () => {
    console.log("A user disconnected", socket.id);
    for (const workspaceId of WorkspacePresenceService.removeSocket(socket.id)) {
      broadcastPresence(io, workspaceId);
    }
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
