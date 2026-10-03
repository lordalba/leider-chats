import { saveChatMessage } from "../../src/services/ChatRoomService";
import Message from "../../src/models/Message";
import mongoose from "mongoose";

// Mock the Message model
jest.mock("../models/Message", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ _id: "mockMessageId" }),
    })),
  };
});

describe("ChatRoomService", () => {
  it("should save a chat message to the database", async () => {
    const mockChatRoomId = new mongoose.Types.ObjectId("chatRoom1");
    const mockSenderId = new mongoose.Types.ObjectId("user1");
    const mockContent = "Hello, world!";

    const savedMessage = await saveChatMessage(
      mockChatRoomId,
      mockSenderId,
      mockContent
    );

    expect(savedMessage).toEqual({ _id: "mockMessageId" });
    expect(Message).toHaveBeenCalledTimes(1);
    expect(Message).toHaveBeenCalledWith({
      chatRoomId: mockChatRoomId,
      sender: mockSenderId,
      content: mockContent,
      seenBy: [],
    });
  });

  it("should handle errors when saving a message", async () => {
    (Message as jest.Mock).mockImplementationOnce(() => ({
      save: jest.fn().mockRejectedValue(new Error("DB Error")),
    }));

    const savedMessage = await saveChatMessage(new mongoose.Types.ObjectId("chatRoom1"), new mongoose.Types.ObjectId("user1"), "Error");
    expect(savedMessage).toBeNull();
  });
});
