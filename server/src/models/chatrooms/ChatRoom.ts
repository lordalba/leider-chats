// models/Message.ts
import mongoose, { Schema } from "mongoose";
import IChatRoom from "../../types/chatrooms/IChatRoom";

const chatRoomSchema = new Schema<IChatRoom>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      content: { type: String },
      timestamp: { type: Date },
    },
    imageUrl: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: false,
    },
    isGroupChat: {
      type: Boolean,
      required: true
    },
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    adminPermissions: {
      type: Boolean,
      required: true,
      default: false
    },
  },
  { timestamps: true }
);

export default mongoose.model<IChatRoom>("ChatRoom", chatRoomSchema);
