import Document from "../../models/workspaces/Document";
import { assertWorkspaceMember, requireText, toObjectId, WorkspaceError } from "./WorkspaceAccess";
import { ItemMeta } from "./WorkspaceService";
import { yDocManager } from "./mongoYDocStore";

const toMeta = (doc: InstanceType<typeof Document>): ItemMeta => ({
  _id: doc._id as ItemMeta["_id"],
  title: doc.title,
  updatedAt: doc.updatedAt,
  createdBy: doc.createdBy,
});

export const assertDocumentMember = async (
  userId: string,
  docId: unknown
): Promise<{ workspaceId: string; docId: string }> => {
  const doc = await Document.findById(toObjectId(docId)).select("workspace");
  if (!doc) throw new WorkspaceError("not_found");
  const { workspace } = await assertWorkspaceMember(String(doc.workspace), userId);
  return { workspaceId: String(workspace._id), docId: String(doc._id) };
};

export const createDocument = async (
  userId: string,
  workspaceId: string,
  title: string
): Promise<ItemMeta & { workspaceId: string }> => {
  const { workspace } = await assertWorkspaceMember(workspaceId, userId);
  const doc = await Document.create({
    title: requireText(title, 1, 120),
    createdBy: toObjectId(userId),
    workspace: workspace._id,
  });
  return { ...toMeta(doc), workspaceId: String(workspace._id) };
};

export const renameDocument = async (
  userId: string,
  docId: string,
  title: string
): Promise<ItemMeta & { workspaceId: string }> => {
  const { workspaceId } = await assertDocumentMember(userId, docId);
  const clean = requireText(title, 1, 120);
  const doc = await Document.findById(toObjectId(docId));
  if (!doc) throw new WorkspaceError("not_found");
  doc.title = clean;
  await doc.save();
  return { ...toMeta(doc), workspaceId };
};

export const deleteDocument = async (
  userId: string,
  docId: string
): Promise<{ workspaceId: string; docId: string }> => {
  const result = await assertDocumentMember(userId, docId);
  yDocManager.delete(result.docId);
  await Document.deleteOne({ _id: toObjectId(result.docId) });
  return result;
};
