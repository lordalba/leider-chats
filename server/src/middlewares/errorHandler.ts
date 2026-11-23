import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { HttpError } from "../http/HttpError";
import { WorkspaceError } from "../services/workspaces/WorkspaceAccess";

const WORKSPACE_STATUS: Record<string, number> = { forbidden: 403, not_found: 404, invalid: 400, board_full: 409 };

/** Unknown API routes. */
export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found." });
};

/**
 * The single place where request errors become responses. Expected errors (HttpError,
 * workspace access errors, invalid ids) get their status; anything else is logged and is a 500.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error instanceof WorkspaceError) {
    return res.status(WORKSPACE_STATUS[error.code] || 400).json({ message: error.code });
  }
  if (error instanceof mongoose.Error.CastError || error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: "Invalid data." });
  }
  if (error instanceof SyntaxError) {
    return res.status(400).json({ message: "Invalid JSON." });
  }
  console.error(`[http] ${req.method} ${req.originalUrl} failed:`, error);
  return res.status(500).json({ message: "Server error." });
};
