import mongoose, { Document } from "mongoose";

export default interface IWorkspace extends Document {
  name: string;
  description: string;
  chatRoomId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
