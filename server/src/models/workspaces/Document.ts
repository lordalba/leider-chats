import mongoose, { Schema } from "mongoose";
import IDocument from "../../types/workspaces/IDocument";

const documentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true },
    ydocState: { type: Buffer, default: null, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<IDocument>("Document", documentSchema);
