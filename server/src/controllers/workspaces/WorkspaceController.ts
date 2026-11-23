import { Response } from "express";
import { MyUserRequest } from "../../types/express";
import { WorkspaceError } from "../../services/workspaces/WorkspaceAccess";
import { getWorkspaceDetail, listWorkspaces } from "../../services/workspaces/WorkspaceService";

// Reads only. All workspace writes go over Socket.IO (see socketHandlers/workspaces).

const STATUS_BY_CODE: Record<string, number> = { forbidden: 403, not_found: 404, invalid: 400 };

const sendError = (res: Response, error: unknown): Response => {
  if (error instanceof WorkspaceError) {
    return res.status(STATUS_BY_CODE[error.code] || 400).json({ message: error.code });
  }
  console.error("[workspaces] REST error:", error);
  return res.status(500).json({ message: "server_error" });
};

export const getAllWorkspaces = async (req: MyUserRequest, res: Response) => {
  try {
    const chatRoomId = typeof req.query.chatRoomId === "string" ? req.query.chatRoomId : undefined;
    return res.json(await listWorkspaces(String(req.userId), chatRoomId));
  } catch (error) {
    return sendError(res, error);
  }
};

export const getWorkspaceById = async (req: MyUserRequest, res: Response) => {
  try {
    return res.json(await getWorkspaceDetail(String(req.userId), req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
};
