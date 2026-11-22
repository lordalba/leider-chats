import { IStroke } from "../../types/workspaces/IWhiteboard";
import { WorkspaceError } from "./WorkspaceAccess";

export const MAX_STROKE_NUMBERS = 4000;
export const MIN_STROKE_NUMBERS = 2;
export const STROKE_WIDTH_MIN = 1;
export const STROKE_WIDTH_MAX = 40;
export const MAX_STROKES_PER_BOARD = 5000;

const COLOR_RE = /^#[0-9a-f]{6}$/i;
const STROKE_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

function invalid(): never {
  throw new WorkspaceError("invalid");
}

export function validateStrokeId(id: unknown): string {
  if (typeof id !== "string" || !STROKE_ID_RE.test(id)) invalid();
  return id;
}

/**
 * Validate a client stroke against the Global Constraints. The author is
 * always the socket's user; any userId in the input is ignored.
 */
export function validateStroke(input: unknown, userId: string): IStroke {
  if (typeof input !== "object" || input === null || Array.isArray(input)) invalid();
  const { id, color, width, points } = input as Record<string, unknown>;

  const strokeId = validateStrokeId(id);
  if (typeof color !== "string" || !COLOR_RE.test(color)) invalid();
  if (
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width < STROKE_WIDTH_MIN ||
    width > STROKE_WIDTH_MAX
  ) {
    invalid();
  }
  if (
    !Array.isArray(points) ||
    points.length < MIN_STROKE_NUMBERS ||
    points.length > MAX_STROKE_NUMBERS ||
    points.length % 2 !== 0
  ) {
    invalid();
  }
  for (const p of points as unknown[]) {
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) invalid();
  }

  return {
    id: strokeId,
    userId: String(userId),
    color,
    width,
    points: [...(points as number[])],
    createdAt: new Date(),
  };
}
