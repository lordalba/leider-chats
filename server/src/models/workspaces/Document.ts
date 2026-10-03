import mongoose, { Schema } from "mongoose";
import IDocument from "../../types/workspaces/IDocument";

const documentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true },
    content: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
