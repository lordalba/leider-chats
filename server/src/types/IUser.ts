import mongoose, { Document } from "mongoose";

export default interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    friends: mongoose.Types.ObjectId[];
    friendRequests: mongoose.Types.ObjectId[];
    age: Number,
    profession: string,
    location: string,
    aboutMe: string;
    skills: string[];
    profilePictureUrl: string;
    backgroundPictureUrl: string;
    lastConnected: Date;
  }