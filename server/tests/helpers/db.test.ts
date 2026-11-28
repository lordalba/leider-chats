import { connectTestDb, clearTestDb, disconnectTestDb } from "./db";
import { makeUser, makeChat } from "./fixtures";
import User from "../../src/models/User";

describe("test db helpers", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  it("creates users and a group chat, then clears", async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const chat = await makeChat([a, b], [a]);
    expect(chat.isGroupChat).toBe(true);
    expect(chat.participants).toHaveLength(2);
    expect(chat.admins).toHaveLength(1);
    await clearTestDb();
    expect(await User.countDocuments()).toBe(0);
  });
});
