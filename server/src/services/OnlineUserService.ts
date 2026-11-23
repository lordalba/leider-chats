/** userId -> ids of that user's connected sockets (one per open tab). */
const onlineUsers: Record<string, string[]> = {};

export const OnlineUserService = {
  setUserOnline(userId: string, socketId: string) {
    if (!onlineUsers[userId]) onlineUsers[userId] = [];
    if (!onlineUsers[userId].includes(socketId)) onlineUsers[userId].push(socketId);
  },

  /**
   * Forgets a socket. Returns the user id only when that was the user's last socket
   * (they are now offline); returns null while they still have another tab open.
   */
  removeUserSocket(socketId: string): string | null {
    for (const userId of Object.keys(onlineUsers)) {
      const index = onlineUsers[userId].indexOf(socketId);
      if (index === -1) continue;
      onlineUsers[userId].splice(index, 1);
      if (onlineUsers[userId].length > 0) return null;
      delete onlineUsers[userId];
      return userId;
    }
    return null;
  },

  getUserSockets(userId: string): string[] | undefined {
    return onlineUsers[userId];
  },

  isUserOnline(userId: string): boolean {
    return Object.prototype.hasOwnProperty.call(onlineUsers, userId);
  },

  getOnlineUsers() {
    return onlineUsers;
  },
};
