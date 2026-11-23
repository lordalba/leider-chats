import mongoose, { Schema } from "mongoose";
import IGif from "../types/IGif";

const gifSchema = new Schema<IGif>(
  {
    url: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IGif>("Gif", gifSchema);
