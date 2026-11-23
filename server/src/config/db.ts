import mongoose from "mongoose";
import { gifLibraryService } from "../services/GifLibraryService";

/** Connects to MongoDB and makes sure the built-in data (default GIFs) exists. Exits if the DB is unreachable. */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }

  try {
    await gifLibraryService.ensureDefaults();
  } catch (error) {
    // Not fatal: the app works without the default GIFs.
    console.error("Couldn't add the default GIFs:", error);
  }
};

export default connectDB;
