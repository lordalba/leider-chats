import { Server } from "socket.io";
import mongoose from "mongoose";
import Workspace from "../../models/workspaces/Workspace";
import Document from "../../models/workspaces/Document";
import Whiteboard from "../../models/workspaces/Whiteboard";
import { WorkspacePresenceService } from "../../services/workspaces/WorkspacePresenceService";
import { deleteWorkspacesForChat } from "../../services/workspaces/WorkspaceService";
import { toObjectId } from "../../services/workspaces/WorkspaceAccess";
import { yDocManager } from "../../services/workspaces/mongoYDocStore";
import { docRoom, wbRoom, wsRoom } from "./rooms";

export type WorkspaceChildren = { docIds: string[]; wbIds: string[] };

export const broadcastPresence = (io: Server, workspaceId: string): void => {
  io.to(wsRoom(workspaceId)).emit("workspace:presence", {
    workspaceId,
    members: WorkspacePresenceService.members(workspaceId),
  });
};

/** Looks up the documents and whiteboards of each workspace (so their rooms can be closed). */
export const collectChildren = async (
  workspaceIds: string[]
): Promise<Map<string, WorkspaceChildren>> => {
  const result = new Map<string, WorkspaceChildren>();
  workspaceIds.forEach((id) => result.set(id, { docIds: [], wbIds: [] }));
  if (workspaceIds.length === 0) return result;

  const ids = workspaceIds.map((id) => new mongoose.Types.ObjectId(id));
  const [docs, wbs] = await Promise.all([
    Document.find({ workspace: { $in: ids } }).select("_id workspace").lean(),
    Whiteboard.find({ workspace: { $in: ids } }).select("_id workspace").lean(),
  ]);
  docs.forEach((d) => result.get(String(d.workspace))?.docIds.push(String(d._id)));
  wbs.forEach((w) => result.get(String(w.workspace))?.wbIds.push(String(w._id)));
  return result;
};

const roomsOf = (workspaceId: string, children: WorkspaceChildren): string[] => [
  wsRoom(workspaceId),
  ...children.docIds.map(docRoom),
  ...children.wbIds.map(wbRoom),
];

/** Tells everyone in a (deleted) workspace that it is gone and empties its rooms. */
export const revokeWorkspaceRooms = (
  io: Server,
  workspaceId: string,
  children: WorkspaceChildren
): void => {
  const rooms = roomsOf(workspaceId, children);
  io.to(rooms).emit("workspace:revoked", { workspaceId });
  io.in(rooms).socketsLeave(rooms);
  WorkspacePresenceService.dropWorkspace(workspaceId);
};

/**
 * The user is no longer in the chat: remove each of their sockets from every room of the chat's
 * workspaces, tell those sockets `workspace:revoked`, and rebroadcast presence.
 */
export const evictUserFromChatWorkspaces = async (
  io: Server,
  chatRoomId: string,
  userId: string
): Promise<void> => {
  const workspaces = await Workspace.find({ chatRoomId: toObjectId(chatRoomId) }).select("_id").lean();
  if (workspaces.length === 0) return;
  const workspaceIds = workspaces.map((w) => String(w._id));
  const childrenByWs = await collectChildren(workspaceIds);

  const userSockets = Array.from(io.of("/").sockets.values()).filter(
    (s) => s.data && s.data.userId === String(userId)
  );

  for (const workspaceId of workspaceIds) {
    const children = childrenByWs.get(workspaceId) || { docIds: [], wbIds: [] };
    const rooms = roomsOf(workspaceId, children);
    let touched = false;

    for (const socket of userSockets) {
      const inPresence = WorkspacePresenceService.socketsOfUser(workspaceId, String(userId)).includes(socket.id);
      if (!inPresence && !rooms.some((r) => socket.rooms.has(r))) continue;

      rooms.forEach((r) => socket.leave(r));
      await Promise.all(children.docIds.map((docId) => yDocManager.close(docId, socket.id)));
      WorkspacePresenceService.leave(workspaceId, socket.id);
      socket.emit("workspace:revoked", { workspaceId });
      touched = true;
    }

    if (touched) broadcastPresence(io, workspaceId);
  }
};

/** The chat is gone: delete its workspaces and close their rooms. */
export const cascadeDeleteChatWorkspaces = async (io: Server, chatRoomId: string): Promise<void> => {
  const workspaces = await Workspace.find({ chatRoomId: toObjectId(chatRoomId) }).select("_id").lean();
  const workspaceIds = workspaces.map((w) => String(w._id));
  const childrenByWs = await collectChildren(workspaceIds);
  await deleteWorkspacesForChat(chatRoomId);
  workspaceIds.forEach((id) =>
    revokeWorkspaceRooms(io, id, childrenByWs.get(id) || { docIds: [], wbIds: [] })
  );
};
