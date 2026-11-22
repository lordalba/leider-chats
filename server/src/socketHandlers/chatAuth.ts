import { Socket } from "socket.io";
import ChatRoom from "../models/chatrooms/ChatRoom";
import IChatRoom from "../types/chatrooms/IChatRoom";
import { isChatAdmin, toObjectId } from "../services/workspaces/WorkspaceAccess";

// Legacy chat socket events carry no ack, so authorization is a boolean gate on
// the JWT-derived socket.data.userId (never on ids sent in the payload).

/**
 * Tell the client its socket has no valid token (e.g. it reconnected after
 * the JWT expired), at most once per socket.
 */
export const notifyAuthExpired = (socket: Socket): void => {
  if (socket.data.authExpiredNotified) return;
  socket.data.authExpiredNotified = true;
  socket.emit("auth:expired");
};

/**
 * Gate for legacy chat events: true (and the event must be dropped) when the
 * socket is unauthenticated. Emits auth:expired so the client can re-login
 * instead of silently losing the event.
 */
export const refuseUnauthenticated = (socket: Socket, event: string): boolean => {
  if (socket.data.userId) return false;
  console.warn(`${event} refused for socket ${socket.id}: unauthenticated`);
  notifyAuthExpired(socket);
  return true;
};

const loadChatIfParticipant = async (
  socket: Socket,
  chatRoomId: unknown
): Promise<IChatRoom | null> => {
  const userId = socket.data.userId;
  if (!userId) return null;
  try {
    const chat = await ChatRoom.findById(toObjectId(chatRoomId));
    if (!chat) return null;
    const isParticipant = chat.participants.some((p) => String(p) === String(userId));
    return isParticipant ? chat : null;
  } catch (error) {
    // toObjectId throws for malformed ids; treat any failure as "not allowed".
    return null;
  }
};

export const isAuthenticatedChatParticipant = async (
  socket: Socket,
  chatRoomId: unknown
): Promise<boolean> => (await loadChatIfParticipant(socket, chatRoomId)) !== null;

export const isAuthenticatedChatAdmin = async (
  socket: Socket,
  chatRoomId: unknown
): Promise<boolean> => {
  const chat = await loadChatIfParticipant(socket, chatRoomId);
  return !!chat && isChatAdmin(chat, String(socket.data.userId));
};

// Allowed to post: a participant, and an admin when the chat restricts posting.
export const canSendMessage = async (
  socket: Socket,
  chatRoomId: unknown
): Promise<boolean> => {
  const chat = await loadChatIfParticipant(socket, chatRoomId);
  if (!chat) return false;
  return !chat.adminPermissions || isChatAdmin(chat, String(socket.data.userId));
};
