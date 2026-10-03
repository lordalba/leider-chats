// models/Message.ts
import mongoose, { Document } from "mongoose";

export default interface IMessage extends Document {
  chatRoomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  type: {
    type: String,
    enum: ["text", "voice", "image", "location", "file", "system"], // Supported message types
    default: "text",
  },
  mediaUrl: {
    type: String,
    default: null, // URL for voice or image messages
  },
  fileName: {
    type: String,
    default: null, // URL for voice or image messages
  },
  timestamp: Date;
  seenBy: mongoose.Types.ObjectId[];
}
