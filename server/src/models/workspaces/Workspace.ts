import mongoose, { Schema } from "mongoose";
import IWorkspace from "../../types/workspaces/IWorkspace";

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
    chatRoomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Workspace = mongoose.model<IWorkspace>("Workspace", WorkspaceSchema);
export default Workspace;
