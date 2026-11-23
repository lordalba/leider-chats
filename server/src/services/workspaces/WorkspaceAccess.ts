import mongoose from "mongoose";
import ChatRoom from "../../models/chatrooms/ChatRoom";
import Workspace from "../../models/workspaces/Workspace";
import IChatRoom from "../../types/chatrooms/IChatRoom";
import IWorkspace from "../../types/workspaces/IWorkspace";

export type WorkspaceErrorCode = "forbidden" | "not_found" | "invalid" | "board_full";

export class WorkspaceError extends Error {
  code: WorkspaceErrorCode;

  constructor(code: WorkspaceErrorCode) {
    super(code);
    this.code = code;
    this.name = "WorkspaceError";
  }
}

const HEX_24 = /^[0-9a-fA-F]{24}$/;

/** Converts an untrusted id to an ObjectId. Anything that is not a 24-hex string is `not_found`. */
export const toObjectId = (id: unknown): mongoose.Types.ObjectId => {
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id !== "string" || !HEX_24.test(id) || !mongoose.isValidObjectId(id)) {
    throw new WorkspaceError("not_found");
  }
  return new mongoose.Types.ObjectId(id);
};

export const isChatParticipant = (chat: IChatRoom, userId: string): boolean =>
  chat.participants.some((p) => String(p) === String(userId));

export const isChatAdmin = (chat: IChatRoom, userId: string): boolean =>
  (chat.admins || []).some((a) => String(a) === String(userId));

export const assertChatMember = async (
  chatRoomId: string,
  userId: string
): Promise<IChatRoom> => {
  const chat = await ChatRoom.findById(toObjectId(chatRoomId));
  if (!chat) throw new WorkspaceError("not_found");
  if (!isChatParticipant(chat, userId)) throw new WorkspaceError("forbidden");
  return chat;
};

export const assertWorkspaceMember = async (
  workspaceId: string,
  userId: string
): Promise<{ workspace: IWorkspace; chat: IChatRoom }> => {
  const workspace = await Workspace.findById(toObjectId(workspaceId));
  if (!workspace) throw new WorkspaceError("not_found");
  const chat = await ChatRoom.findById(workspace.chatRoomId);
  if (!chat) throw new WorkspaceError("not_found");
  if (!isChatParticipant(chat, userId)) throw new WorkspaceError("forbidden");
  return { workspace, chat };
};

/** Trims `value` and checks its length. Returns the trimmed string or throws `invalid`. */
export const requireText = (value: unknown, min: number, max: number): string => {
  if (typeof value !== "string") throw new WorkspaceError("invalid");
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new WorkspaceError("invalid");
  return trimmed;
};
