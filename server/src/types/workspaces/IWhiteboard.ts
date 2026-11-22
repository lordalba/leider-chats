import mongoose, { Document } from "mongoose";

export interface IStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  // Normalized to [0,1], flat [x0,y0,x1,y1,…].
  points: number[];
  createdAt: Date;
}

export default interface IWhiteboard extends Document {
  title: string;
  // select:false — loaded only by WhiteboardService.getStrokes.
  strokes?: IStroke[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  workspace: mongoose.Types.ObjectId;
}
