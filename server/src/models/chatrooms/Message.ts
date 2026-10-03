// models/Message.ts
import mongoose, { Schema } from "mongoose";
import IMessage from "../../types/chatrooms/IMessage";

const MessageSchema = new Schema<IMessage>(
  {
    chatRoomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    content: {
      type: String,
      required: false,
    },
    type: { type: String, enum: ["text", "voice", "image", "location", "file", "system"], default: "text" },
    mediaUrl: { type: String },
    fileName:
    { type: String,
      required: false,
     },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    seenBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IMessage>("Message", MessageSchema);
