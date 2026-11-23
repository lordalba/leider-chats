import mongoose, { Document } from "mongoose";

export default interface IDocument extends Document {
  title: string;
  /** Full Yjs document state (Y.encodeStateAsUpdate). Not selected by default. */
  ydocState?: Buffer | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  workspace: mongoose.Types.ObjectId; // Link to the workspace
}
