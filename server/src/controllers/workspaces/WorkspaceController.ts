import { Response } from "express";
import { MyUserRequest } from "../../types/express";
import { asyncHandler } from "../../http/asyncHandler";
import { getWorkspaceDetail, listWorkspaces } from "../../services/workspaces/WorkspaceService";

// Reads only. All workspace writes go over Socket.IO (see socketHandlers/workspaces).
// Access errors (WorkspaceError) are turned into 403/404/400 by the error middleware.

export const getAllWorkspaces = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  const chatRoomId = typeof req.query.chatRoomId === "string" ? req.query.chatRoomId : undefined;
  res.json(await listWorkspaces(String(req.userId), chatRoomId));
});

export const getWorkspaceById = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  res.json(await getWorkspaceDetail(String(req.userId), req.params.id));
});
