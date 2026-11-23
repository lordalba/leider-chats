import mongoose from "mongoose";
import Workspace from "../../models/workspaces/Workspace";
import Task from "../../models/workspaces/Task";
import Document from "../../models/workspaces/Document";
import Whiteboard from "../../models/workspaces/Whiteboard";
import ChatRoom from "../../models/chatrooms/ChatRoom";
import Message from "../../models/chatrooms/Message";
import User from "../../models/User";
import IWorkspace from "../../types/workspaces/IWorkspace";
import IMessage from "../../types/chatrooms/IMessage";
import ITask from "../../types/workspaces/ITask";
import {
  WorkspaceError,
  assertChatMember,
  assertWorkspaceMember,
  isChatAdmin,
  requireText,
  toObjectId,
} from "./WorkspaceAccess";
import { yDocManager } from "./mongoYDocStore";

export type ItemMeta = {
  _id: mongoose.Types.ObjectId;
  title: string;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
};

const asObject = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WorkspaceError("invalid");
  }
  return input as Record<string, unknown>;
};

export const createWorkspace = async (
  userId: string,
  chatRoomId: string,
  input: { name: string; description?: string }
): Promise<{ workspace: IWorkspace; message: IMessage }> => {
  const chat = await assertChatMember(chatRoomId, userId);
  const body = asObject(input);
  const name = requireText(body.name, 1, 80);
  const description =
    body.description === undefined || body.description === null
      ? ""
      : requireText(body.description, 0, 500);

  const workspace = await Workspace.create({
    name,
    description,
    chatRoomId: chat._id,
    createdBy: toObjectId(userId),
  });

  const user = await User.findById(userId).select("username");
  const username = user ? user.username : "Someone";
  const message = await Message.create({
    chatRoomId: chat._id,
    content: `${username} created the workspace "${name}"`,
    type: "system",
  });

  return { workspace, message };
};

export const renameWorkspace = async (
  userId: string,
  workspaceId: string,
  patch: { name?: string; description?: string }
): Promise<IWorkspace> => {
  const { workspace } = await assertWorkspaceMember(workspaceId, userId);
  const body = asObject(patch);
  if (body.name === undefined && body.description === undefined) {
    throw new WorkspaceError("invalid");
  }
  if (body.name !== undefined) workspace.name = requireText(body.name, 1, 80);
  if (body.description !== undefined) {
    workspace.description = body.description === null ? "" : requireText(body.description, 0, 500);
  }
  await workspace.save();
  return workspace;
};

/** Deletes workspaces and everything in them. Open Yjs docs are dropped without saving. */
const removeWorkspaces = async (workspaceIds: mongoose.Types.ObjectId[]): Promise<void> => {
  if (workspaceIds.length === 0) return;
  const filter = { workspace: { $in: workspaceIds } };
  const docs = await Document.find(filter).select("_id");
  docs.forEach((doc) => yDocManager.delete(String(doc._id)));
  await Promise.all([
    Task.deleteMany(filter),
    Document.deleteMany(filter),
    Whiteboard.deleteMany(filter),
  ]);
  await Workspace.deleteMany({ _id: { $in: workspaceIds } });
};

export const deleteWorkspace = async (userId: string, workspaceId: string): Promise<IWorkspace> => {
  const { workspace, chat } = await assertWorkspaceMember(workspaceId, userId);
  if (String(workspace.createdBy) !== String(userId) && !isChatAdmin(chat, userId)) {
    throw new WorkspaceError("forbidden");
  }
  await removeWorkspaces([workspace._id as mongoose.Types.ObjectId]);
  return workspace;
};

export const deleteWorkspacesForChat = async (chatRoomId: string): Promise<string[]> => {
  const workspaces = await Workspace.find({ chatRoomId: toObjectId(chatRoomId) }).select("_id");
  const ids = workspaces.map((w) => w._id as mongoose.Types.ObjectId);
  await removeWorkspaces(ids);
  return ids.map(String);
};

type PopulatedParticipant = {
  _id: mongoose.Types.ObjectId;
  username: string;
  profilePictureUrl?: string;
};

/** Group chats use their name; one-on-one chats are named after the other person (like in the app). */
const chatDisplayName = (
  chat: { name?: string; isGroupChat?: boolean; participants: PopulatedParticipant[] },
  userId: string
): string => {
  const others = chat.participants.filter((p) => String(p._id) !== String(userId));
  if (!chat.isGroupChat && others.length) return others.map((p) => p.username).join(", ");
  return chat.name || others.map((p) => p.username).join(", ") || "Chat";
};

export const listWorkspaces = async (
  userId: string,
  chatRoomId?: string
): Promise<(Record<string, unknown> & { chatName: string })[]> => {
  let chatFilter: Record<string, unknown>;
  if (chatRoomId) {
    const chat = await assertChatMember(chatRoomId, userId);
    chatFilter = { _id: chat._id };
  } else {
    chatFilter = { participants: toObjectId(userId) };
  }

  const chats = await ChatRoom.find(chatFilter)
    .select("name participants isGroupChat")
    .populate("participants", "username")
    .lean();
  const nameByChat = new Map<string, string>();
  chats.forEach((chat) => {
    nameByChat.set(
      String(chat._id),
      chatDisplayName(chat as unknown as { name?: string; isGroupChat?: boolean; participants: PopulatedParticipant[] }, userId)
    );
  });

  const workspaces = await Workspace.find({ chatRoomId: { $in: chats.map((c) => c._id) } })
    .sort({ updatedAt: -1 })
    .lean();

  return workspaces.map((w) => ({
    ...(w as unknown as Record<string, unknown>),
    chatName: nameByChat.get(String(w.chatRoomId)) || "Chat",
  }));
};

export const getWorkspaceDetail = async (userId: string, workspaceId: string) => {
  const { workspace, chat } = await assertWorkspaceMember(workspaceId, userId);
  const populated = await ChatRoom.findById(chat._id)
    .select("name participants admins")
    .populate("participants", "username profilePictureUrl")
    .lean();
  const participants = ((populated && populated.participants) || []) as unknown as PopulatedParticipant[];

  const filter = { workspace: workspace._id };
  const [tasks, documents, whiteboards] = await Promise.all([
    Task.find(filter).sort({ status: 1, order: 1, createdAt: 1 }).lean<ITask[]>(),
    Document.find(filter).select("title updatedAt createdBy").sort({ createdAt: 1 }).lean<ItemMeta[]>(),
    Whiteboard.find(filter).select("title updatedAt createdBy").sort({ createdAt: 1 }).lean<ItemMeta[]>(),
  ]);

  return {
    workspace,
    chat: {
      _id: chat._id,
      name: chatDisplayName({ name: chat.name, isGroupChat: chat.isGroupChat, participants }, userId),
      admins: (chat.admins || []).map(String),
      participants: participants.map((p) => ({
        _id: p._id,
        username: p.username,
        profilePictureUrl: p.profilePictureUrl,
      })),
    },
    tasks,
    documents,
    whiteboards,
  };
};
