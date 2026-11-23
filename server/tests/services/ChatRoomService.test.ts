import { Types } from "mongoose";
import ChatRoom from "../../src/models/chatrooms/ChatRoom";
import Message from "../../src/models/chatrooms/Message";
import {
  createChatRoom,
  deleteChatRoom,
  exitChatRoom,
  findOrCreateDirectChat,
  removeUserFromChat,
  saveChatMessage,
} from "../../src/services/ChatRoomService";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser } from "../helpers/fixtures";

const id = (doc: { _id: unknown }) => doc._id as Types.ObjectId;

describe("ChatRoomService", () => {
  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  it("findOrCreateDirectChat reuses the existing private chat", async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const first = await findOrCreateDirectChat(id(a), id(b));
    const second = await findOrCreateDirectChat(id(b), id(a));
    expect(String(second._id)).toBe(String(first._id));
    expect(first.isGroupChat).toBe(false);
    expect(await ChatRoom.countDocuments()).toBe(1);
  });

  it("saveChatMessage stores the message and a readable preview for attachments", async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const chat = await findOrCreateDirectChat(id(a), id(b));
    await saveChatMessage(id(chat), id(a), "", "file", "report.pdf", "http://x/report.pdf");
    const stored = await ChatRoom.findById(chat._id);
    expect(stored!.lastMessage.content).toBe("📎 report.pdf");
    expect(await Message.countDocuments({ chatRoomId: chat._id })).toBe(1);
  });

  it("when the last admin leaves a group, the next member becomes admin", async () => {
    const [a, b, c] = await Promise.all([makeUser("a"), makeUser("b"), makeUser("c")]);
    const group = await createChatRoom([id(a), id(b), id(c)], "G", null, id(a));
    await exitChatRoom(id(group), id(a), "a");
    const stored = await ChatRoom.findById(group._id);
    expect(stored!.participants.map(String)).toEqual([String(b._id), String(c._id)]);
    expect(stored!.admins.map(String)).toEqual([String(b._id)]);
  });

  it("removed members lose admin rights", async () => {
    const [a, b, c] = await Promise.all([makeUser("a"), makeUser("b"), makeUser("c")]);
    const group = await createChatRoom([id(a), id(b), id(c)], "G", null, id(a));
    await ChatRoom.updateOne({ _id: group._id }, { $addToSet: { admins: id(b) } });
    await removeUserFromChat(id(group), id(b), "b", "a");
    const stored = await ChatRoom.findById(group._id);
    expect(stored!.admins.map(String)).toEqual([String(a._id)]);
  });

  it("the last person leaving deletes the chat and its messages", async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const chat = await findOrCreateDirectChat(id(a), id(b));
    await saveChatMessage(id(chat), id(a), "hi", "text", "", "");
    await exitChatRoom(id(chat), id(a), "alice");
    expect(await exitChatRoom(id(chat), id(b), "bob")).toBeNull();
    expect(await ChatRoom.exists({ _id: chat._id })).toBeNull();
    expect(await Message.countDocuments({ chatRoomId: chat._id })).toBe(0);
  });

  it("deleteChatRoom removes the chat and all its messages", async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const chat = await findOrCreateDirectChat(id(a), id(b));
    await saveChatMessage(id(chat), id(a), "hi", "text", "", "");
    await deleteChatRoom(id(chat));
    expect(await ChatRoom.countDocuments()).toBe(0);
    expect(await Message.countDocuments()).toBe(0);
  });
});
