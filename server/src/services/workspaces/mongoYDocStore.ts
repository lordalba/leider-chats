import Document from "../../models/workspaces/Document";
import { YDocManager, YDocStore } from "./YDocManager";

export const mongoYDocStore: YDocStore = {
  async load(docId: string): Promise<Uint8Array | null> {
    const doc = await Document.findById(docId).select("+ydocState");
    if (!doc || !doc.ydocState) return null;
    return new Uint8Array(doc.ydocState);
  },

  async save(docId: string, state: Uint8Array): Promise<void> {
    await Document.updateOne({ _id: docId }, { $set: { ydocState: Buffer.from(state) } });
  },
};

export const yDocManager = new YDocManager(mongoYDocStore);
