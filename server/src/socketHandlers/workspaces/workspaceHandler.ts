import { Server, Socket } from "socket.io";
import User from "../../models/User";
import {
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
} from "../../services/workspaces/WorkspaceService";
import { WorkspaceError, assertWorkspaceMember } from "../../services/workspaces/WorkspaceAccess";
import { Focus, WorkspacePresenceService } from "../../services/workspaces/WorkspacePresenceService";
import { notifyChatParticipants } from "../notifyChatParticipants";
import { withAck } from "./withAck";
import { wsRoom } from "./rooms";
import { broadcastPresence, collectChildren, revokeWorkspaceRooms } from "./revoke";

const FOCUS_KINDS = ["document", "task", "whiteboard"];

const parseFocus = (value: unknown): Focus | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new WorkspaceError("invalid");
  const { kind, id } = value as Record<string, unknown>;
  if (typeof kind !== "string" || !FOCUS_KINDS.includes(kind)) throw new WorkspaceError("invalid");
  if (typeof id !== "string" || id.length === 0 || id.length > 64) throw new WorkspaceError("invalid");
  return { kind: kind as Focus["kind"], id };
};

const workspaceHandler = (io: Server, socket: Socket) => {
  socket.on(
    "workspace:create",
    withAck(socket, async (userId, chatRoomId: string, input: { name: string; description?: string }) => {
      const { workspace, message } = await createWorkspace(userId, chatRoomId, input);
      const chatId = String(workspace.chatRoomId);
      io.to(chatId).emit("newMessage", message);
      await notifyChatParticipants(io, chatId, "chat:workspaces-changed", { chatRoomId: chatId });
      return workspace;
    })
  );

  socket.on(
    "workspace:rename",
    withAck(socket, async (userId, workspaceId: string, patch: { name?: string; description?: string }) => {
      const workspace = await renameWorkspace(userId, workspaceId, patch);
      const id = String(workspace._id);
      const chatId = String(workspace.chatRoomId);
      io.to(wsRoom(id)).emit("workspace:updated", workspace);
      await notifyChatParticipants(io, chatId, "chat:workspaces-changed", { chatRoomId: chatId });
      return workspace;
    })
  );

  socket.on(
    "workspace:delete",
    withAck(socket, async (userId, workspaceId: string) => {
      // Look up the child rooms first: they are gone once the workspace is deleted.
      const { workspace } = await assertWorkspaceMember(workspaceId, userId);
      const id = String(workspace._id);
      const children = (await collectChildren([id])).get(id) || { docIds: [], wbIds: [] };

      await deleteWorkspace(userId, id);
      revokeWorkspaceRooms(io, id, children);
      const chatId = String(workspace.chatRoomId);
      await notifyChatParticipants(io, chatId, "chat:workspaces-changed", { chatRoomId: chatId });
      return null;
    })
  );

  socket.on(
    "workspace:join",
    withAck(socket, async (userId, workspaceId: string) => {
      const { workspace } = await assertWorkspaceMember(workspaceId, userId);
      const id = String(workspace._id);
      const user = await User.findById(userId).select("username profilePictureUrl");

      WorkspacePresenceService.join(id, socket.id, {
        userId,
        username: user ? user.username : "Unknown",
        profilePictureUrl: user ? user.profilePictureUrl : undefined,
      });
      socket.join(wsRoom(id));
      broadcastPresence(io, id);
      return { members: WorkspacePresenceService.members(id) };
    })
  );

  socket.on(
    "workspace:leave",
    withAck(socket, async (_userId, workspaceId: unknown) => {
      if (typeof workspaceId !== "string") throw new WorkspaceError("not_found");
      WorkspacePresenceService.leave(workspaceId, socket.id);
      socket.leave(wsRoom(workspaceId));
      broadcastPresence(io, workspaceId);
      return null;
    })
  );

  socket.on(
    "workspace:focus",
    withAck(socket, async (userId, workspaceId: string, focusInput: unknown) => {
      const { workspace } = await assertWorkspaceMember(workspaceId, userId);
      const id = String(workspace._id);
      WorkspacePresenceService.setFocus(id, socket.id, parseFocus(focusInput));
      broadcastPresence(io, id);
      return null;
    })
  );
};

export default workspaceHandler;
