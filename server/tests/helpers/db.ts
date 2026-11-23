import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer: MongoMemoryServer | null = null;

export const connectTestDb = async (): Promise<void> => {
  let uri = process.env.MONGO_TEST_URI;
  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri);
};

export const clearTestDb = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

export const disconnectTestDb = async (): Promise<void> => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};
