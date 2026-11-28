import mongoose from "mongoose";
import { saveChatMessage } from "../../src/services/ChatRoomService";
import Message from "../../src/models/chatrooms/Message";
import ChatRoom from "../../src/models/chatrooms/ChatRoom";

jest.mock("../../src/models/chatrooms/Message", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../../src/models/chatrooms/ChatRoom", () => ({
  __esModule: true,
  default: { findByIdAndUpdate: jest.fn().mockResolvedValue(null) },
}));

const MessageMock = Message as unknown as jest.Mock;
const findByIdAndUpdate = ChatRoom.findByIdAndUpdate as jest.Mock;

describe("ChatRoomService.saveChatMessage", () => {
  const chatRoomId = new mongoose.Types.ObjectId();
  const senderId = new mongoose.Types.ObjectId();
  const timestamp = new Date("2026-11-28T12:00:00Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves the message, updates the room's last message and returns it populated", async () => {
    const populated = { _id: "mockMessageId", populated: true };
    const instance = {
      timestamp,
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockReturnValue(populated),
    };
    MessageMock.mockImplementation(() => instance);

    const result = await saveChatMessage(chatRoomId, senderId, "Hello, world!", "text", "", "");

    expect(MessageMock).toHaveBeenCalledWith({
      chatRoomId,
      senderId,
      content: "Hello, world!",
      seenBy: [senderId],
      type: "text",
      fileName: "",
      mediaUrl: "",
    });
    expect(instance.save).toHaveBeenCalledTimes(1);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(chatRoomId, {
      lastMessage: { content: "Hello, world!", timestamp },
    });
    expect(instance.populate).toHaveBeenCalledWith("senderId", "username profilePictureUrl");
    expect(result).toBe(populated);
  });

  it("rejects and leaves the room untouched when saving fails", async () => {
    MessageMock.mockImplementation(() => ({
      timestamp,
      save: jest.fn().mockRejectedValue(new Error("DB Error")),
      populate: jest.fn(),
    }));

    await expect(
      saveChatMessage(chatRoomId, senderId, "Error", "text", "", "")
    ).rejects.toThrow("DB Error");
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
