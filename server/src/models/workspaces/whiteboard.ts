import mongoose, { Schema } from "mongoose";
import IWhiteboard, { IStroke } from "../../types/workspaces/IWhiteboard";

// `id: false` keeps the Mongoose `id` virtual from shadowing the stroke id.
const strokeSchema = new Schema<IStroke>(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    color: { type: String, required: true },
    width: { type: Number, required: true },
    points: { type: [Number], required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false, id: false }
);

const whiteboardSchema = new Schema<IWhiteboard>(
  {
    title: { type: String, required: true },
    strokes: { type: [strokeSchema], default: [], select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Whiteboard", whiteboardSchema);
