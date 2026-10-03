import mongoose, { Schema } from "mongoose";
import IUser from "../types/IUser";

const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  age: { type: Number, required: true },
  profession: { type: String, required: true },
  location: { type: String, required: true },
  aboutMe: { type: String, required: false },
  skills: [{ type: String, required: false }],
  profilePictureUrl: { type: String, required: false },
  backgroundPictureUrl: { type: String, required: false },
  lastConnected: {type: Date, required: false}
});

export default mongoose.model<IUser>("User", userSchema);
