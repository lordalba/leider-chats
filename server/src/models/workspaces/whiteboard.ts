// schemas/whiteboardSchema.ts
import mongoose, { Schema } from "mongoose";
import IWhiteboard from "../../types/workspaces/IWhiteboard";

const whiteboardSchema = new Schema<IWhiteboard>(
  {
    title: { type: String, required: true },
    canvasData: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Whiteboard", whiteboardSchema);
