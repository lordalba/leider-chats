import mongoose, { Document } from "mongoose";

export default interface IDocument extends Document {
  title: string;
  // Full Yjs state (Y.encodeStateAsUpdate); select:false, read by mongoYDocStore only.
  ydocState?: Buffer;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  workspace: mongoose.Types.ObjectId; // Link to the workspace
}
