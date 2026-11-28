import mongoose from "mongoose";
import Workspace from "../../models/workspaces/Workspace";
import ChatRoom from "../../models/chatrooms/ChatRoom";
import IWorkspace from "../../types/workspaces/IWorkspace";
import IChatRoom from "../../types/chatrooms/IChatRoom";

export type WorkspaceErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid"
  | "board_full";

export class WorkspaceError extends Error {
  code: WorkspaceErrorCode;

  constructor(code: WorkspaceErrorCode, message?: string) {
    super(message || code);
    Object.setPrototypeOf(this, WorkspaceError.prototype);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

export function toObjectId(id: unknown): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  throw new WorkspaceError("not_found");
}

export function isChatAdmin(chat: IChatRoom, userId: string): boolean {
  return (chat.admins || []).some((a) => String(a) === String(userId));
}

export async function assertChatMember(
  chatRoomId: string,
  userId: string
): Promise<IChatRoom> {
  const chat = await ChatRoom.findById(toObjectId(chatRoomId));
  if (!chat) throw new WorkspaceError("not_found");
  if (!chat.participants.some((p) => String(p) === String(userId))) {
    throw new WorkspaceError("forbidden");
  }
  return chat;
}

export async function assertWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<{ workspace: IWorkspace; chat: IChatRoom }> {
  const workspace = await Workspace.findById(toObjectId(workspaceId));
  if (!workspace) throw new WorkspaceError("not_found");
  const chat = await assertChatMember(String(workspace.chatRoomId), userId);
  return { workspace, chat };
}
