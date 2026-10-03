import mongoose, { Document } from "mongoose";

export default interface IDocument extends Document {
  title: string;
  content: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  workspace: mongoose.Types.ObjectId; // Link to the workspace
}
