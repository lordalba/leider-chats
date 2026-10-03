// types/ITask.ts
import mongoose, { Document } from "mongoose";

export default interface ITask extends Document {
  title: string;
  description: string;
  assignedTo: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  status: TaskStatus;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  workspace: mongoose.Types.ObjectId;
}

export enum TaskStatus {
    TODO = "todo",
    IN_PROGRESS = "inProgress",
    VERIFY = "verify",
    DONE = "done",
  }