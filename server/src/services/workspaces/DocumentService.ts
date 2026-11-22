import DocumentModel from "../../models/workspaces/Document";
import IDocument from "../../types/workspaces/IDocument";
import { WorkspaceError, assertWorkspaceMember, toObjectId } from "./WorkspaceAccess";
import { yDocManager } from "./YDocManager";

export const DOCUMENT_TITLE_MAX = 120;

export type ItemMeta = { _id: string; title: string; updatedAt: Date };

export function validateItemTitle(title: unknown): string {
  if (typeof title !== "string") throw new WorkspaceError("invalid");
  const t = title.trim();
  if (t.length < 1 || t.length > DOCUMENT_TITLE_MAX) throw new WorkspaceError("invalid");
  return t;
}

const toMeta = (doc: IDocument): ItemMeta => ({
  _id: String(doc._id),
  title: doc.title,
  updatedAt: doc.updatedAt,
});

async function loadDocumentForMember(userId: string, docId: string) {
  const doc = await DocumentModel.findById(toObjectId(docId));
  if (!doc) throw new WorkspaceError("not_found");
  await assertWorkspaceMember(String(doc.workspace), userId);
  return doc;
}

export async function assertDocumentMember(
  userId: string,
  docId: string
): Promise<{ workspaceId: string }> {
  const doc = await loadDocumentForMember(userId, docId);
  return { workspaceId: String(doc.workspace) };
}

export async function createDocument(
  userId: string,
  workspaceId: string,
  title: unknown
): Promise<ItemMeta> {
  const { workspace } = await assertWorkspaceMember(workspaceId, userId);
  const doc = await DocumentModel.create({
    title: validateItemTitle(title),
    workspace: workspace._id,
    createdBy: toObjectId(userId),
  });
  return toMeta(doc);
}

export async function renameDocument(
  userId: string,
  docId: string,
  title: unknown
): Promise<ItemMeta & { workspaceId: string }> {
  const doc = await loadDocumentForMember(userId, docId);
  doc.title = validateItemTitle(title);
  await doc.save();
  return { ...toMeta(doc), workspaceId: String(doc.workspace) };
}

export async function deleteDocument(
  userId: string,
  docId: string
): Promise<{ workspaceId: string }> {
  const doc = await loadDocumentForMember(userId, docId);
  await DocumentModel.deleteOne({ _id: doc._id });
  yDocManager.delete(String(doc._id));
  return { workspaceId: String(doc.workspace) };
}

/** True if the document still exists (used to close a doc:open/delete race). */
export async function documentExists(docId: string): Promise<boolean> {
  return (await DocumentModel.exists({ _id: toObjectId(docId) })) !== null;
}
