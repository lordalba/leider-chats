import { Server, Socket } from "socket.io";
import User from "../../models/User";
import { withAck } from "./withAck";
import { wsRoom } from "./rooms";
import { notifyChatParticipants } from "../notifyChatParticipants";
import {
  WorkspaceError,
  assertWorkspaceMember,
  toObjectId,
} from "../../services/workspaces/WorkspaceAccess";
import {
  Focus,
  PresenceMember,
  WorkspacePresenceService,
} from "../../services/workspaces/WorkspacePresenceService";
import {
  broadcastPresence,
  collectWorkspaceRooms,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  revokeWorkspaceRooms,
} from "../../services/workspaces/WorkspaceService";

const FOCUS_KINDS = ["document", "task", "whiteboard"];

function parseFocus(focus: unknown): Focus | null {
  if (focus === null || focus === undefined) return null;
  if (
    typeof focus === "object" &&
    FOCUS_KINDS.includes((focus as Focus).kind) &&
    typeof (focus as Focus).id === "string" &&
    /^[0-9a-fA-F]{24}$/.test((focus as Focus).id)
  ) {
    return { kind: (focus as Focus).kind, id: (focus as Focus).id };
  }
  throw new WorkspaceError("invalid");
}

const notifyWorkspacesChanged = (io: Server, chatRoomId: string) =>
  notifyChatParticipants(io, chatRoomId, "chat:workspaces-changed", { chatRoomId });

const workspaceHandler = (io: Server, socket: Socket) => {
  socket.on(
    "workspace:create",
    withAck(socket, async (userId, chatRoomId: string, input: { name: string; description?: string }) => {
      const { workspace, message } = await createWorkspace(userId, chatRoomId, input);
      const chatId = String(workspace.chatRoomId);
      io.to(chatId).emit("newMessage", message);
      await notifyWorkspacesChanged(io, chatId);
      return workspace;
    })
  );

  socket.on(
    "workspace:rename",
    withAck(socket, async (userId, workspaceId: string, patch: { name?: string; description?: string }) => {
      const workspace = await renameWorkspace(userId, workspaceId, patch);
      io.to(wsRoom(String(workspace._id))).emit("workspace:updated", workspace);
      await notifyWorkspacesChanged(io, String(workspace.chatRoomId));
      return workspace;
    })
  );

  socket.on(
    "workspace:delete",
    withAck(socket, async (userId, workspaceId: string) => {
      // Gather room names first (read-only); the item ids are gone after delete.
      const rooms = await collectWorkspaceRooms([String(toObjectId(workspaceId))]);
      const workspace = await deleteWorkspace(userId, workspaceId);
      await revokeWorkspaceRooms(io, rooms);
      await notifyWorkspacesChanged(io, String(workspace.chatRoomId));
      return null;
    })
  );

  socket.on(
    "workspace:join",
    withAck(socket, async (userId, workspaceId: string): Promise<{ members: PresenceMember[] }> => {
      const { workspace } = await assertWorkspaceMember(workspaceId, userId);
      const id = String(workspace._id);
      const user = await User.findById(toObjectId(userId)).select("username profilePictureUrl");
      if (!user) throw new WorkspaceError("forbidden");

      // The socket may have disconnected while we awaited; the disconnect
      // handler has already run removeSocket, so adding presence now would
      // leave a ghost member behind.
      if (!socket.connected) return { members: WorkspacePresenceService.members(id) };

      const undo = () => {
        socket.leave(wsRoom(id));
        WorkspacePresenceService.leave(id, socket.id);
      };

      socket.join(wsRoom(id));
      WorkspacePresenceService.join(id, socket.id, {
        userId: String(userId),
        username: user.username,
        ...(user.profilePictureUrl && { profilePictureUrl: user.profilePictureUrl }),
      });

      // Re-check now that the socket is in the room: an eviction that ran
      // during the awaits above would otherwise be silently undone. Any
      // eviction that starts after this point sees the socket in the room.
      try {
        await assertWorkspaceMember(id, userId);
      } catch (err) {
        undo();
        throw err;
      }
      if (!socket.connected) {
        undo();
        return { members: WorkspacePresenceService.members(id) };
      }

      broadcastPresence(io, id);
      return { members: WorkspacePresenceService.members(id) };
    })
  );

  socket.on(
    "workspace:leave",
    withAck(socket, async (_userId, workspaceId: string) => {
      const id = String(toObjectId(workspaceId));
      // A socket that never joined has no presence to remove; skip the
      // rebroadcast so outsiders cannot trigger presence events.
      if (!socket.rooms.has(wsRoom(id))) return null;
      socket.leave(wsRoom(id));
      WorkspacePresenceService.leave(id, socket.id);
      broadcastPresence(io, id);
      return null;
    })
  );

  socket.on(
    "workspace:focus",
    withAck(socket, async (userId, workspaceId: string, focus: unknown) => {
      const { workspace } = await assertWorkspaceMember(workspaceId, userId);
      const id = String(workspace._id);
      WorkspacePresenceService.setFocus(id, socket.id, parseFocus(focus));
      broadcastPresence(io, id);
      return null;
    })
  );
};

export default workspaceHandler;
