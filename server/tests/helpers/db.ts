import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer | undefined;

export async function connectTestDb(): Promise<void> {
  const uri =
    process.env.MONGO_TEST_URI ||
    (mongod = await MongoMemoryServer.create()).getUri();
  await mongoose.connect(uri);
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = undefined;
  }
}
