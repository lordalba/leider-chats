// models/Message.ts
import mongoose, { Document } from "mongoose";

export type MessageType = "text" | "voice" | "image" | "location" | "file" | "system";

export default interface IMessage extends Document {
  chatRoomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  type: MessageType;
  /** URL for voice, image and file messages. */
  mediaUrl: string | null;
  /** Original name of an attached file. */
  fileName: string | null;
  timestamp: Date;
  editedAt?: Date | null;
  deleted?: boolean;
  createdAt?: Date;
  seenBy: mongoose.Types.ObjectId[];
}
