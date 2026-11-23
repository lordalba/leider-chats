import Whiteboard from "../../models/workspaces/whiteboard";
import { IStroke } from "../../types/workspaces/IWhiteboard";
import {
  WorkspaceError,
  assertWorkspaceMember,
  isChatAdmin,
  requireText,
  toObjectId,
} from "./WorkspaceAccess";
import { ItemMeta } from "./WorkspaceService";
import { MAX_STROKES_PER_BOARD, validateStroke } from "./strokeValidation";

const toMeta = (wb: InstanceType<typeof Whiteboard>): ItemMeta => ({
  _id: wb._id as ItemMeta["_id"],
  title: wb.title,
  updatedAt: wb.updatedAt,
  createdBy: wb.createdBy,
});

export const assertWhiteboardMember = async (userId: string, whiteboardId: unknown) => {
  const whiteboard = await Whiteboard.findById(toObjectId(whiteboardId)).select("workspace createdBy");
  if (!whiteboard) throw new WorkspaceError("not_found");
  const { workspace, chat } = await assertWorkspaceMember(String(whiteboard.workspace), userId);
  return {
    workspaceId: String(workspace._id),
    whiteboardId: String(whiteboard._id),
    whiteboard,
    chat,
  };
};

export const createWhiteboard = async (
  userId: string,
  workspaceId: string,
  title: string
): Promise<ItemMeta & { workspaceId: string }> => {
  const { workspace } = await assertWorkspaceMember(workspaceId, userId);
  const wb = await Whiteboard.create({
    title: requireText(title, 1, 120),
    strokes: [],
    createdBy: toObjectId(userId),
    workspace: workspace._id,
  });
  return { ...toMeta(wb), workspaceId: String(workspace._id) };
};

export const renameWhiteboard = async (
  userId: string,
  whiteboardId: string,
  title: string
): Promise<ItemMeta & { workspaceId: string }> => {
  const { workspaceId } = await assertWhiteboardMember(userId, whiteboardId);
  const clean = requireText(title, 1, 120);
  const wb = await Whiteboard.findById(toObjectId(whiteboardId));
  if (!wb) throw new WorkspaceError("not_found");
  wb.title = clean;
  await wb.save();
  return { ...toMeta(wb), workspaceId };
};

export const deleteWhiteboard = async (
  userId: string,
  whiteboardId: string
): Promise<{ workspaceId: string; whiteboardId: string }> => {
  const { workspaceId, whiteboardId: id } = await assertWhiteboardMember(userId, whiteboardId);
  await Whiteboard.deleteOne({ _id: toObjectId(id) });
  return { workspaceId, whiteboardId: id };
};

export const addStroke = async (
  userId: string,
  whiteboardId: string,
  input: unknown
): Promise<IStroke> => {
  const stroke = validateStroke(input, userId);
  const _id = toObjectId(whiteboardId);
  // Atomic cap: only push while the 5000th slot is still empty.
  const result = await Whiteboard.updateOne(
    { _id, [`strokes.${MAX_STROKES_PER_BOARD - 1}`]: { $exists: false } },
    { $push: { strokes: stroke } }
  );
  if (result.matchedCount === 0) {
    const exists = await Whiteboard.exists({ _id });
    throw new WorkspaceError(exists ? "board_full" : "not_found");
  }
  return stroke;
};

/** Removes one of the caller's own strokes. Someone else's stroke id is `not_found`. */
export const undoStroke = async (userId: string, whiteboardId: string, strokeId: unknown): Promise<void> => {
  if (typeof strokeId !== "string") throw new WorkspaceError("not_found");
  const result = await Whiteboard.updateOne(
    { _id: toObjectId(whiteboardId), strokes: { $elemMatch: { id: strokeId, userId } } },
    { $pull: { strokes: { id: strokeId, userId } } }
  );
  if (result.modifiedCount === 0) throw new WorkspaceError("not_found");
};

export const clearWhiteboard = async (userId: string, whiteboardId: string): Promise<void> => {
  const { whiteboard, chat } = await assertWhiteboardMember(userId, whiteboardId);
  if (String(whiteboard.createdBy) !== String(userId) && !isChatAdmin(chat, userId)) {
    throw new WorkspaceError("forbidden");
  }
  await Whiteboard.updateOne({ _id: whiteboard._id }, { $set: { strokes: [] } });
};

export const getStrokes = async (userId: string, whiteboardId: string): Promise<IStroke[]> => {
  const { whiteboardId: id } = await assertWhiteboardMember(userId, whiteboardId);
  const wb = await Whiteboard.findById(toObjectId(id)).select("+strokes").lean();
  return wb ? wb.strokes : [];
};
