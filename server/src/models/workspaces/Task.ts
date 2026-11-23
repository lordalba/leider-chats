import mongoose, { Schema } from "mongoose";
import ITask, { TaskStatus } from "../../types/workspaces/ITask";

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.TODO,
      required: true,
    },
    order: { type: Number, required: true, default: 0 },
    dueDate: { type: Date, default: null },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
  },
  { timestamps: true }
);

taskSchema.index({ workspace: 1, status: 1, order: 1 });

export default mongoose.model<ITask>("Task", taskSchema);
