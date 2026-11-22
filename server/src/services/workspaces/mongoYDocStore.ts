import mongoose from "mongoose";
import DocumentModel from "../../models/workspaces/Document";
import type { YDocStore } from "./YDocManager";

const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

/** YDocStore backed by Document.ydocState (a select:false Buffer). */
export const mongoYDocStore: YDocStore = {
  async load(docId) {
    if (!isObjectId(docId)) return null;
    const doc = await DocumentModel.findById(docId).select("+ydocState").lean();
    const state = doc && (doc as { ydocState?: unknown }).ydocState;
    if (!state) return null;
    // .lean() yields a BSON Binary; normalise to a plain Uint8Array.
    const bytes =
      state instanceof mongoose.mongo.Binary ? state.buffer : (state as Uint8Array);
    return new Uint8Array(bytes);
  },

  async save(docId, state) {
    if (!isObjectId(docId)) return;
    // updateOne on a deleted document is a no-op, never a resurrection.
    await DocumentModel.updateOne(
      { _id: docId },
      { $set: { ydocState: Buffer.from(state) } }
    );
  },
};
