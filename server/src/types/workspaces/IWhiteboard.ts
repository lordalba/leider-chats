import mongoose, { Document } from "mongoose";

export default interface IWhiteboard extends Document {
  title: string;
  canvasData: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  workspace: mongoose.Types.ObjectId;
}
