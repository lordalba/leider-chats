import mongoose, { Document } from "mongoose";

export default interface IChatRoom extends Document {
  participants: mongoose.Types.ObjectId[];
  name: string;
  imageUrl: string;
  isGroupChat: boolean;
  lastMessage: {
    content: string;
    timestamp: Date;
  };
  admins: mongoose.Types.ObjectId[];
  adminPermissions: boolean;
}
