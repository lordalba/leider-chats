import { OnlineUserService } from "../../src/services/OnlineUserService";

describe("OnlineUserService", () => {
  beforeEach(() => {
    // Clear onlineUsers before each test
    const onlineUsers = OnlineUserService.getOnlineUsers();
    for (const userId in onlineUsers) {
      delete onlineUsers[userId];
    }
  });

  it("should add a socket ID for a user", () => {
    OnlineUserService.setUserOnline("user1", "socket1");
    expect(OnlineUserService.getUserSockets("user1")).toEqual(["socket1"]);
  });

  it("should add multiple socket IDs for the same user", () => {
    OnlineUserService.setUserOnline("user1", "socket1");
    OnlineUserService.setUserOnline("user1", "socket2");
    expect(OnlineUserService.getUserSockets("user1")).toEqual(["socket1", "socket2"]);
  });

  it("should remove a socket ID for a user and keep them online if other sockets exist", () => {
    OnlineUserService.setUserOnline("user1", "socket1");
    OnlineUserService.setUserOnline("user1", "socket2");

    const userId = OnlineUserService.removeUserSocket("socket1");
    expect(userId).toBeNull(); // User is still online
    expect(OnlineUserService.getUserSockets("user1")).toEqual(["socket2"]);
  });

  it("should remove a socket ID and mark the user offline if no sockets remain", () => {
    OnlineUserService.setUserOnline("user1", "socket1");

    const userId = OnlineUserService.removeUserSocket("socket1");
    expect(userId).toBe("user1"); // User goes offline
    expect(OnlineUserService.getUserSockets("user1")).toBeUndefined();
  });

  it("should return undefined if getting sockets for a user that does not exist", () => {
    expect(OnlineUserService.getUserSockets("user1")).toBeUndefined();
  });

  it("should correctly identify if a user is online", () => {
    OnlineUserService.setUserOnline("user1", "socket1");
    expect(OnlineUserService.isUserOnline("user1")).toBe(true);
    expect(OnlineUserService.isUserOnline("user2")).toBe(false);
  });

  it("should return an empty object when no users are online", () => {
    expect(OnlineUserService.getOnlineUsers()).toEqual({});
  });

  it("should return all online users", () => {
    OnlineUserService.setUserOnline("user1", "socket1");
    OnlineUserService.setUserOnline("user2", "socket2");
    expect(OnlineUserService.getOnlineUsers()).toEqual({
      user1: ["socket1"],
      user2: ["socket2"],
    });
  });
});
