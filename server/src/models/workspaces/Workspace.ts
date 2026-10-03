import mongoose, { Schema } from "mongoose";
import { WorkspaceRole } from "../../types/workspaces/IWorkspace";

const ParticipantSchema = new Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: Object.values(WorkspaceRole),
    default: WorkspaceRole.VIEWER,
    required: true,
  },
});

const WorkspaceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: {
      type: [ParticipantSchema],
      validate: {
        validator: (value: any[]) => Array.isArray(value) && value.length > 0,
        message: "A workspace must have at least one participant.",
      },
      required: true,
    },
    documents: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Document",
      },
    ],
    whiteboards: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Whiteboard",
      },
    ],
    tasks: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Task",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Workspace = mongoose.model("Workspace", WorkspaceSchema);
export default Workspace;
