/**
 * Creates test accounts for local development (safe to run more than once).
 *
 *   npm run seed
 *
 * - Test users (all with the same password) who are friends with each other and with every
 *   existing account, plus a private chat between each pair of friends.
 * - One group chat with a description and a few sample messages.
 */
import "../src/config/env";
import bcrypt from "bcrypt";
import mongoose, { Types } from "mongoose";
import User from "../src/models/User";
import ChatRoom from "../src/models/chatrooms/ChatRoom";
import Message from "../src/models/chatrooms/Message";
import { findOrCreateDirectChat } from "../src/services/ChatRoomService";
import { DEFAULT_GROUP_IMAGE, uploadUrl } from "../src/utils/files";

const PASSWORD = "test1234";
const GROUP_NAME = "Test group";

const TEST_USERS = [
  { username: "alice", profession: "Designer", location: "Tel Aviv", age: 27, aboutMe: "I make things pretty. Ask me about colours." },
  { username: "bob", profession: "Developer", location: "Haifa", age: 31, aboutMe: "Backend person. Coffee first, code second." },
  { username: "carol", profession: "Product manager", location: "Jerusalem", age: 29, aboutMe: "Turning ideas into plans." },
  { username: "dave", profession: "Musician", location: "Eilat", age: 24, aboutMe: "Guitar, piano and too many playlists." },
  { username: "erin", profession: "Student", location: "Beersheba", age: 21, aboutMe: "Computer science, year 2." },
  { username: "frank", profession: "Photographer", location: "Netanya", age: 35, aboutMe: "Weddings, landscapes and my cat." },
];

const emailFor = (username: string) => `${username}@test.com`;

async function upsertTestUsers(): Promise<Types.ObjectId[]> {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const ids: Types.ObjectId[] = [];
  for (const profile of TEST_USERS) {
    const email = emailFor(profile.username);
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        ...profile,
        email,
        password: hash,
        skills: [],
        profilePictureUrl: uploadUrl("profilePictures/default-avatar.svg"),
      });
      console.log(`created ${email}`);
    } else {
      console.log(`exists  ${email}`);
    }
    ids.push(user._id as Types.ObjectId);
  }
  return ids;
}

/** Everyone becomes friends with everyone (test users and existing accounts) and gets private chats. */
async function connectEveryone(testUserIds: Types.ObjectId[]) {
  const everyone = (await User.find().select("_id")).map((u) => u._id as Types.ObjectId);
  for (const testUserId of testUserIds) {
    for (const otherId of everyone) {
      if (otherId.equals(testUserId)) continue;
      await User.updateOne({ _id: testUserId }, { $addToSet: { friends: otherId } });
      await User.updateOne({ _id: otherId }, { $addToSet: { friends: testUserId } });
      await findOrCreateDirectChat(testUserId, otherId);
    }
  }
}

async function ensureGroupChat(testUserIds: Types.ObjectId[]) {
  if (await ChatRoom.exists({ name: GROUP_NAME, isGroupChat: true })) return;
  const [admin, ...rest] = testUserIds;
  const group = await ChatRoom.create({
    name: GROUP_NAME,
    description: "A place to try out group features: workspaces, files, GIFs and code blocks.",
    participants: testUserIds,
    admins: [admin],
    isGroupChat: true,
    imageUrl: DEFAULT_GROUP_IMAGE(),
  });

  const lines: [Types.ObjectId, string][] = [
    [admin, "Welcome to the test group 👋"],
    [rest[0], "Here's how to say hi in JavaScript:\n```js\nconst greet = (name) => `Hi ${name}!`;\nconsole.log(greet(\"everyone\"));\n```"],
    [rest[1], "Nice! You can also use `inline code` in a sentence."],
  ];
  let time = Date.now() - lines.length * 60_000;
  for (const [senderId, content] of lines) {
    time += 60_000;
    await Message.create({ chatRoomId: group._id, senderId, content, type: "text", seenBy: [senderId], timestamp: new Date(time) });
  }
  await ChatRoom.updateOne({ _id: group._id }, { lastMessage: { content: lines[lines.length - 1][1], timestamp: new Date(time) } });
  console.log(`created group chat "${GROUP_NAME}"`);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI as string);
  const ids = await upsertTestUsers();
  await connectEveryone(ids);
  await ensureGroupChat(ids);
  console.log(`\nDone. Log in with any of: ${TEST_USERS.map((u) => emailFor(u.username)).join(", ")}`);
  console.log(`Password for all of them: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
