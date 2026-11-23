import mongoose, { Document } from "mongoose";

export interface IStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  /** Flat [x0, y0, x1, y1, ...] normalized to [0, 1]. */
  points: number[];
  createdAt: Date;
}

export default interface IWhiteboard extends Document {
  title: string;
  /** Not selected by default. */
  strokes: IStroke[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  workspace: mongoose.Types.ObjectId;
}
