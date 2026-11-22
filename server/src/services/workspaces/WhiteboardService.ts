import Whiteboard from "../../models/workspaces/whiteboard";
import IWhiteboard, { IStroke } from "../../types/workspaces/IWhiteboard";
import { WorkspaceError, assertWorkspaceMember, isChatAdmin, toObjectId } from "./WorkspaceAccess";
import { ItemMeta, validateItemTitle } from "./DocumentService";
import { MAX_STROKES_PER_BOARD, validateStroke, validateStrokeId } from "./strokeValidation";

// Whiteboard meta also carries createdBy: the client shows "Clear board"
// only to the creator (or a chat admin).
type WhiteboardMeta = ItemMeta & { createdBy: string };

const toMeta = (wb: IWhiteboard): WhiteboardMeta => ({
  _id: String(wb._id),
  title: wb.title,
  updatedAt: wb.updatedAt,
  createdBy: String(wb.createdBy),
});

async function loadWhiteboardForMember(userId: string, whiteboardId: string, withStrokes = false) {
  const query = Whiteboard.findById(toObjectId(whiteboardId));
  if (withStrokes) query.select("+strokes");
  const wb = await query;
  if (!wb) throw new WorkspaceError("not_found");
  const { chat } = await assertWorkspaceMember(String(wb.workspace), userId);
  return { wb, chat };
}

export async function assertWhiteboardMember(
  userId: string,
  whiteboardId: string
): Promise<{ workspaceId: string }> {
  const { wb } = await loadWhiteboardForMember(userId, whiteboardId);
  return { workspaceId: String(wb.workspace) };
}

export async function createWhiteboard(
  userId: string,
  workspaceId: string,
  title: unknown
): Promise<WhiteboardMeta> {
  const { workspace } = await assertWorkspaceMember(workspaceId, userId);
  const wb = await Whiteboard.create({
    title: validateItemTitle(title),
    workspace: workspace._id,
    createdBy: toObjectId(userId),
  });
  return toMeta(wb);
}

export async function renameWhiteboard(
  userId: string,
  whiteboardId: string,
  title: unknown
): Promise<WhiteboardMeta & { workspaceId: string }> {
  const { wb } = await loadWhiteboardForMember(userId, whiteboardId);
  wb.title = validateItemTitle(title);
  await wb.save();
  return { ...toMeta(wb), workspaceId: String(wb.workspace) };
}

export async function deleteWhiteboard(
  userId: string,
  whiteboardId: string
): Promise<{ workspaceId: string }> {
  const { wb } = await loadWhiteboardForMember(userId, whiteboardId);
  await Whiteboard.deleteOne({ _id: wb._id });
  return { workspaceId: String(wb.workspace) };
}

export async function getStrokes(userId: string, whiteboardId: string): Promise<IStroke[]> {
  const { wb } = await loadWhiteboardForMember(userId, whiteboardId, true);
  return (wb.toObject().strokes || []) as IStroke[];
}

/**
 * Append a stroke atomically: the filter only matches while the board has
 * fewer than MAX_STROKES_PER_BOARD strokes and no stroke with this id, so a
 * resent stroke (e.g. after an ack timeout) is stored once.
 */
export async function addStroke(
  userId: string,
  whiteboardId: string,
  input: unknown
): Promise<IStroke> {
  const { wb } = await loadWhiteboardForMember(userId, whiteboardId);
  const stroke = validateStroke(input, userId);
  const result = await Whiteboard.updateOne(
    {
      _id: wb._id,
      [`strokes.${MAX_STROKES_PER_BOARD - 1}`]: { $exists: false },
      "strokes.id": { $ne: stroke.id },
    },
    { $push: { strokes: stroke } }
  );
  if (result.matchedCount === 1) return stroke;

  const current = await Whiteboard.findById(wb._id).select("+strokes").lean();
  if (!current) throw new WorkspaceError("not_found");
  const existing = (current.strokes || []).find((s) => s.id === stroke.id);
  if (existing) {
    // Someone else's stroke id: refuse rather than hand back their stroke.
    if (existing.userId !== stroke.userId) throw new WorkspaceError("invalid");
    return existing;
  }
  throw new WorkspaceError("board_full");
}

/** Remove one of the caller's own strokes; another user's stroke is not_found. */
export async function undoStroke(
  userId: string,
  whiteboardId: string,
  strokeId: unknown
): Promise<void> {
  const { wb } = await loadWhiteboardForMember(userId, whiteboardId);
  const id = validateStrokeId(strokeId);
  // Ownership is enforced in the filter ($elemMatch on id + author); stroke
  // ids are unique per board (addStroke dedups), so the pull by id then
  // removes exactly that stroke.
  const result = await Whiteboard.updateOne(
    { _id: wb._id, strokes: { $elemMatch: { id, userId: String(userId) } } },
    { $pull: { strokes: { id } } }
  );
  if (result.matchedCount === 0) throw new WorkspaceError("not_found");
}

/** Allowed for the whiteboard's creator or a chat admin. */
export async function clearWhiteboard(userId: string, whiteboardId: string): Promise<void> {
  const { wb, chat } = await loadWhiteboardForMember(userId, whiteboardId);
  const isCreator = String(wb.createdBy) === String(userId);
  if (!isCreator && !isChatAdmin(chat, userId)) throw new WorkspaceError("forbidden");
  await Whiteboard.updateOne({ _id: wb._id }, { $set: { strokes: [] } });
}
