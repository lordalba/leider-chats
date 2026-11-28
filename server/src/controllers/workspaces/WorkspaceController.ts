import { Response } from "express";
import { MyUserRequest } from "../../types/express";
import { WorkspaceError } from "../../services/workspaces/WorkspaceAccess";
import {
  getWorkspaceDetail,
  listWorkspaces,
} from "../../services/workspaces/WorkspaceService";

const statusFor = (error: WorkspaceError): number => {
  switch (error.code) {
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "invalid":
      return 400;
    default:
      return 500;
  }
};

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof WorkspaceError) {
    return res.status(statusFor(error)).json({ error: error.code });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: "server_error" });
};

// GET /api/workspaces?chatRoomId=
export const getWorkspaces = async (req: MyUserRequest, res: Response) => {
  try {
    const { chatRoomId } = req.query;
    if (chatRoomId !== undefined && typeof chatRoomId !== "string") {
      return res.status(400).json({ error: "invalid" });
    }
    const workspaces = await listWorkspaces(String(req.userId), chatRoomId || undefined);
    return res.json(workspaces);
  } catch (error) {
    return sendError(res, error, "Error listing workspaces");
  }
};

// GET /api/workspaces/:id
export const getWorkspaceById = async (req: MyUserRequest, res: Response) => {
  try {
    const detail = await getWorkspaceDetail(String(req.userId), req.params.id);
    return res.json(detail);
  } catch (error) {
    return sendError(res, error, "Error retrieving workspace");
  }
};
