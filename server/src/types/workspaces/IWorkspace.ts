import mongoose, { Document, Types } from "mongoose";

export default interface IWorkspace extends Document {
  name: string;
  description: string;
  createdBy: mongoose.Types.ObjectId;
  participants: IWorkspaceParticipant[];
  documents: mongoose.Types.ObjectId[];
  whiteboards: mongoose.Types.ObjectId[];
  tasks: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceParticipant {
    user: mongoose.Types.ObjectId;
    role: WorkspaceRole;
  }

export enum WorkspaceRole {
    OWNER = "owner",
    ADMIN = "admin",
    EDITOR = "editor",
    VIEWER = "viewer",
  }