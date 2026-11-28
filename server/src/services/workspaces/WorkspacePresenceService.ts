export type Focus = { kind: "document" | "task" | "whiteboard"; id: string };

export interface PresenceMember {
  userId: string;
  username: string;
  profilePictureUrl?: string;
  focus: Focus | null;
}

interface Entry {
  user: Omit<PresenceMember, "focus">;
  focus: Focus | null;
  focusAt: number;
}

// workspaceId -> socketId -> entry (Map preserves insertion = join order)
const presence = new Map<string, Map<string, Entry>>();
let focusCounter = 0;

export const WorkspacePresenceService = {
  join(workspaceId: string, socketId: string, user: Omit<PresenceMember, "focus">): void {
    let sockets = presence.get(workspaceId);
    if (!sockets) {
      sockets = new Map();
      presence.set(workspaceId, sockets);
    }
    if (sockets.has(socketId)) return;
    sockets.set(socketId, { user, focus: null, focusAt: 0 });
  },

  leave(workspaceId: string, socketId: string): void {
    const sockets = presence.get(workspaceId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) presence.delete(workspaceId);
  },

  setFocus(workspaceId: string, socketId: string, focus: Focus | null): void {
    const entry = presence.get(workspaceId)?.get(socketId);
    if (!entry) return;
    entry.focus = focus;
    entry.focusAt = focus ? ++focusCounter : 0;
  },

  members(workspaceId: string): PresenceMember[] {
    const sockets = presence.get(workspaceId);
    if (!sockets) return [];
    const byUser = new Map<string, PresenceMember & { at: number }>();
    for (const { user, focus, focusAt } of sockets.values()) {
      const existing = byUser.get(user.userId);
      if (!existing) {
        byUser.set(user.userId, { ...user, focus, at: focusAt });
      } else if (focus && focusAt > existing.at) {
        existing.focus = focus;
        existing.at = focusAt;
      }
    }
    return [...byUser.values()].map(({ at, ...m }) => m);
  },

  removeSocket(socketId: string): string[] {
    const affected: string[] = [];
    for (const [workspaceId, sockets] of [...presence]) {
      if (sockets.delete(socketId)) {
        affected.push(workspaceId);
        if (sockets.size === 0) presence.delete(workspaceId);
      }
    }
    return affected;
  },

  socketsOfUser(workspaceId: string, userId: string): string[] {
    const sockets = presence.get(workspaceId);
    if (!sockets) return [];
    return [...sockets].filter(([, e]) => e.user.userId === userId).map(([id]) => id);
  },

  reset(): void {
    presence.clear();
    focusCounter = 0;
  },
};
