const onlineUsers: Record<string, string[]> = {};

export const OnlineUserService = {
  setUserOnline(userId: string, socketId: string) {
    if (!onlineUsers[userId]) {
      onlineUsers[userId] = [];
    }
    onlineUsers[userId].push(socketId);
  },

  removeUserSocket(socketId: string): string | null {
    for (const userId in onlineUsers) {
      const socketIndex = onlineUsers[userId].indexOf(socketId);
      if (socketIndex !== -1) {
        onlineUsers[userId].splice(socketIndex, 1);
        if (onlineUsers[userId].length === 0) {
          delete onlineUsers[userId];
        }
        
        return userId;
      }
    }
    return null;
  },

  getUserSockets(userId: string): string[] | undefined {
    return onlineUsers[userId];
  },

  isUserOnline(userId: string): boolean {
    return onlineUsers.hasOwnProperty(userId);
  },

  getOnlineUsers() {
    return onlineUsers;
  },
};
