import mongoose, { Document } from "mongoose";

/** A GIF in the shared library that every user can send. */
export default interface IGif extends Document {
  url: string;
  title: string;
  /** Who uploaded it; null for the built-in defaults. */
  addedBy: mongoose.Types.ObjectId | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
