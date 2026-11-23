import { IStroke } from "../../types/workspaces/IWhiteboard";
import { WorkspaceError } from "./WorkspaceAccess";

export const MAX_STROKES_PER_BOARD = 5000;
export const MAX_POINT_NUMBERS = 4000;

const STROKE_ID = /^[A-Za-z0-9-]{1,64}$/;
const COLOR = /^#[0-9a-f]{6}$/i;

export const isValidPoints = (points: unknown): points is number[] => {
  if (!Array.isArray(points)) return false;
  if (points.length < 2 || points.length > MAX_POINT_NUMBERS || points.length % 2 !== 0) return false;
  return points.every((p) => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1);
};

export const isValidColor = (color: unknown): color is string => typeof color === "string" && COLOR.test(color);

export const isValidWidth = (width: unknown): width is number =>
  typeof width === "number" && Number.isFinite(width) && width >= 1 && width <= 40;

export const isValidStrokeId = (id: unknown): id is string => typeof id === "string" && STROKE_ID.test(id);

/** Validates an untrusted stroke. `userId` always comes from the socket, never from the input. */
export const validateStroke = (input: unknown, userId: string): IStroke => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WorkspaceError("invalid");
  const { id, color, width, points } = input as Record<string, unknown>;
  if (!isValidStrokeId(id)) throw new WorkspaceError("invalid");
  if (!isValidColor(color)) throw new WorkspaceError("invalid");
  if (!isValidWidth(width)) throw new WorkspaceError("invalid");
  if (!isValidPoints(points)) throw new WorkspaceError("invalid");
  return {
    id,
    userId,
    color: color.toLowerCase(),
    width,
    points: points.slice(),
    createdAt: new Date(),
  };
};
