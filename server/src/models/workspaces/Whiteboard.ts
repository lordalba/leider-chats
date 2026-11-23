// schemas/whiteboardSchema.ts
import mongoose, { Schema } from "mongoose";
import IWhiteboard, { IStroke } from "../../types/workspaces/IWhiteboard";

const strokeSchema = new Schema<IStroke>(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    color: { type: String, required: true },
    width: { type: Number, required: true },
    points: { type: [Number], required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const whiteboardSchema = new Schema<IWhiteboard>(
  {
    title: { type: String, required: true },
    strokes: { type: [strokeSchema], default: [], select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<IWhiteboard>("Whiteboard", whiteboardSchema);
