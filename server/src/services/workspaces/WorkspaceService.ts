import mongoose from "mongoose";
import { Server, Socket } from "socket.io";
import Workspace from "../../models/workspaces/Workspace";
import ChatRoom from "../../models/chatrooms/ChatRoom";
import Message from "../../models/chatrooms/Message";
import User from "../../models/User";
import Task from "../../models/workspaces/Task";
import DocumentModel from "../../models/workspaces/Document";
import { yDocManager } from "./YDocManager";
import Whiteboard from "../../models/workspaces/whiteboard";
import IWorkspace from "../../types/workspaces/IWorkspace";
import IMessage from "../../types/chatrooms/IMessage";
import ITask from "../../types/workspaces/ITask";
import {
  WorkspaceError,
  assertChatMember,
  assertWorkspaceMember,
  isChatAdmin,
  toObjectId,
} from "./WorkspaceAccess";
import { WorkspacePresenceService } from "./WorkspacePresenceService";
import { wsRoom, docRoom, wbRoom } from "../../socketHandlers/workspaces/rooms";

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;

export interface ItemMeta {
  _id: mongoose.Types.ObjectId;
  title: string;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
}

export interface ChatParticipantSummary {
  _id: mongoose.Types.ObjectId;
  username: string;
  profilePictureUrl?: string;
}

export interface WorkspaceDetail {
  workspace: IWorkspace;
  chat: {
    _id: mongoose.Types.ObjectId;
    name?: string;
    participants: ChatParticipantSummary[];
    admins: string[];
  };
  tasks: ITask[];
  documents: ItemMeta[];
  whiteboards: ItemMeta[];
}

function validateName(name: unknown): string {
  if (typeof name !== "string") throw new WorkspaceError("invalid");
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
    throw new WorkspaceError("invalid");
  }
  return trimmed;
}

function validateDescription(description: unknown): string {
  if (typeof description !== "string") throw new WorkspaceError("invalid");
  const trimmed = description.trim();
  if (trimmed.length > DESCRIPTION_MAX) throw new WorkspaceError("invalid");
  return trimmed;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function createWorkspace(
  userId: string,
  chatRoomId: string,
  input: { name: string; description?: string }
): Promise<{ workspace: IWorkspace; message: IMessage }> {
  const chat = await assertChatMember(chatRoomId, userId);
  if (!isPlainObject(input)) throw new WorkspaceError("invalid");
  const name = validateName(input.name);
  const description =
    input.description === undefined ? undefined : validateDescription(input.description);

  const user = await User.findById(toObjectId(userId)).select("username");
  if (!user) throw new WorkspaceError("forbidden");

  const workspace = await Workspace.create({
    name,
    ...(description !== undefined && { description }),
    chatRoomId: chat._id,
    createdBy: user._id,
  });

  const message = await Message.create({
    chatRoomId: chat._id,
    content: `${user.username} created the workspace "${name}"`,
    type: "system",
  });

  return { workspace, message };
}

export async function renameWorkspace(
  userId: string,
  workspaceId: string,
  patch: { name?: string; description?: string }
): Promise<IWorkspace> {
  const { workspace } = await assertWorkspaceMember(workspaceId, userId);
  if (!isPlainObject(patch)) throw new WorkspaceError("invalid");
  if (patch.name === undefined && patch.description === undefined) {
    throw new WorkspaceError("invalid");
  }
  if (patch.name !== undefined) workspace.name = validateName(patch.name);
  if (patch.description !== undefined) {
    workspace.description = validateDescription(patch.description);
  }
  await workspace.save();
  return workspace;
}

async function purgeWorkspaces(ids: mongoose.Types.ObjectId[]): Promise<void> {
  if (ids.length === 0) return;
  // Drop live Yjs docs first so a pending debounced save can't outlive them.
  const docs = await DocumentModel.find({ workspace: { $in: ids } }).select("_id").lean();
  for (const d of docs) yDocManager.delete(String(d._id));
  await Promise.all([
    Task.deleteMany({ workspace: { $in: ids } }),
    DocumentModel.deleteMany({ workspace: { $in: ids } }),
    Whiteboard.deleteMany({ workspace: { $in: ids } }),
  ]);
  await Workspace.deleteMany({ _id: { $in: ids } });
}

export async function deleteWorkspace(
  userId: string,
  workspaceId: string
): Promise<IWorkspace> {
  const { workspace, chat } = await assertWorkspaceMember(workspaceId, userId);
  const isCreator = String(workspace.createdBy) === String(userId);
  if (!isCreator && !isChatAdmin(chat, userId)) {
    throw new WorkspaceError("forbidden");
  }
  await purgeWorkspaces([workspace._id as mongoose.Types.ObjectId]);
  return workspace;
}

export async function deleteWorkspacesForChat(chatRoomId: string): Promise<string[]> {
  const workspaces = await Workspace.find({ chatRoomId: toObjectId(chatRoomId) }).select("_id");
  const ids = workspaces.map((w) => w._id as mongoose.Types.ObjectId);
  await purgeWorkspaces(ids);
  return ids.map(String);
}

function chatDisplayName(
  chat: { name?: string; participants: unknown[] },
  userId: string
): string {
  if (chat.name) return chat.name;
  return (chat.participants as { _id: unknown; username?: string }[])
    .filter((p) => p && String(p._id) !== String(userId) && p.username)
    .map((p) => p.username)
    .join(", ");
}

export async function listWorkspaces(
  userId: string,
  chatRoomId?: string
): Promise<(IWorkspace & { chatName: string })[]> {
  let filter: Record<string, unknown>;
  if (chatRoomId) {
    const chat = await assertChatMember(chatRoomId, userId);
    filter = { _id: chat._id };
  } else {
    filter = { participants: toObjectId(userId) };
  }

  const chats = await ChatRoom.find(filter)
    .select("name participants")
    .populate("participants", "username")
    .lean();
  const nameByChat = new Map<string, string>();
  for (const chat of chats) {
    nameByChat.set(String(chat._id), chatDisplayName(chat as any, userId));
  }

  const workspaces = await Workspace.find({
    chatRoomId: { $in: chats.map((c) => c._id) },
  })
    .sort({ createdAt: 1 })
    .lean();

  return workspaces.map((w) => ({
    ...w,
    chatName: nameByChat.get(String(w.chatRoomId)) || "",
  })) as unknown as (IWorkspace & { chatName: string })[];
}

export async function getWorkspaceDetail(
  userId: string,
  workspaceId: string
): Promise<WorkspaceDetail> {
  const { workspace } = await assertWorkspaceMember(workspaceId, userId);
  const wsId = workspace._id;

  const [chat, tasks, documents, whiteboards] = await Promise.all([
    ChatRoom.findById(workspace.chatRoomId)
      .select("name participants admins")
      .populate("participants", "username profilePictureUrl")
      .lean(),
    Task.find({ workspace: wsId }).sort({ order: 1, createdAt: 1 }),
    DocumentModel.find({ workspace: wsId }).select("_id title updatedAt createdBy").lean(),
    Whiteboard.find({ workspace: wsId }).select("_id title updatedAt createdBy").lean(),
  ]);
  if (!chat) throw new WorkspaceError("not_found");

  return {
    workspace,
    chat: {
      _id: chat._id as mongoose.Types.ObjectId,
      name: chat.name,
      participants: chat.participants as unknown as ChatParticipantSummary[],
      admins: (chat.admins || []).map(String),
    },
    tasks,
    documents: documents as unknown as ItemMeta[],
    whiteboards: whiteboards as unknown as ItemMeta[],
  };
}

// ---- realtime helpers (rooms / revocation) ----

/** wsId -> all rooms belonging to that workspace (ws:, doc:*, wb:*). */
export async function collectWorkspaceRooms(
  workspaceIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (workspaceIds.length === 0) return result;
  const objectIds = workspaceIds.map((id) => toObjectId(id));
  const [docs, boards] = await Promise.all([
    DocumentModel.find({ workspace: { $in: objectIds } }).select("_id workspace").lean(),
    Whiteboard.find({ workspace: { $in: objectIds } }).select("_id workspace").lean(),
  ]);
  for (const id of workspaceIds) result.set(String(id), [wsRoom(String(id))]);
  for (const d of docs) result.get(String(d.workspace))?.push(docRoom(String(d._id)));
  for (const b of boards) result.get(String(b.workspace))?.push(wbRoom(String(b._id)));
  return result;
}

export function broadcastPresence(io: Server, workspaceId: string): void {
  io.to(wsRoom(workspaceId)).emit("workspace:presence", {
    workspaceId,
    members: WorkspacePresenceService.members(workspaceId),
  });
}

/**
 * Revoke every socket currently in any room of the given workspaces:
 * emits workspace:revoked, drops presence and makes them leave the rooms.
 * Used when workspaces are deleted (directly or via chat deletion).
 */
export async function revokeWorkspaceRooms(
  io: Server,
  roomsByWorkspace: Map<string, string[]>
): Promise<void> {
  for (const [workspaceId, rooms] of roomsByWorkspace) {
    io.to(rooms).emit("workspace:revoked", { workspaceId });
    const sockets = await io.in(wsRoom(workspaceId)).fetchSockets();
    for (const s of sockets) WorkspacePresenceService.leave(workspaceId, s.id);
    io.in(rooms).socketsLeave(rooms);
  }
}

/** Revoke and delete all workspaces of a chat (chat deleted / emptied). */
export async function cascadeDeleteChatWorkspaces(
  io: Server,
  chatRoomId: string
): Promise<string[]> {
  const workspaces = await Workspace.find({ chatRoomId: toObjectId(chatRoomId) }).select("_id");
  const rooms = await collectWorkspaceRooms(workspaces.map((w) => String(w._id)));
  await revokeWorkspaceRooms(io, rooms);
  return deleteWorkspacesForChat(chatRoomId);
}

/**
 * Every connected socket authenticated (socket.data.userId, set by
 * socketAuth) as the given user — all of their tabs/devices.
 */
export function socketsOfUser(io: Server, userId: string): Socket[] {
  return [...io.sockets.sockets.values()].filter(
    (s) => s.data.userId !== undefined && String(s.data.userId) === String(userId)
  );
}

/**
 * Remove one user (all of their sockets) from every workspace of a chat they
 * no longer belong to. Sockets are matched on socket.data.userId (set by
 * socketAuth), not on OnlineUserService.
 */
export async function evictUserFromChatWorkspaces(
  io: Server,
  chatRoomId: string,
  userId: string
): Promise<void> {
  const workspaces = await Workspace.find({ chatRoomId: toObjectId(chatRoomId) }).select("_id");
  if (workspaces.length === 0) return;
  const rooms = await collectWorkspaceRooms(workspaces.map((w) => String(w._id)));

  for (const socket of socketsOfUser(io, userId)) {
    for (const [workspaceId, workspaceRooms] of rooms) {
      for (const room of workspaceRooms) socket.leave(room);
      WorkspacePresenceService.leave(workspaceId, socket.id);
      socket.emit("workspace:revoked", { workspaceId });
    }
  }

  for (const workspaceId of rooms.keys()) broadcastPresence(io, workspaceId);
}
