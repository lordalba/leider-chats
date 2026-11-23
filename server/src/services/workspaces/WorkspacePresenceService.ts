export type FocusKind = "document" | "task" | "whiteboard";
export type Focus = { kind: FocusKind; id: string };

export interface PresenceMember {
  userId: string;
  username: string;
  profilePictureUrl?: string;
  focus: Focus | null;
}

type Entry = {
  user: Omit<PresenceMember, "focus">;
  focus: Focus | null;
  focusAt: number;
};

// workspaceId -> socketId -> entry
const workspaces = new Map<string, Map<string, Entry>>();
let clock = 0;

export const WorkspacePresenceService = {
  join(workspaceId: string, socketId: string, user: Omit<PresenceMember, "focus">): void {
    let sockets = workspaces.get(workspaceId);
    if (!sockets) {
      sockets = new Map();
      workspaces.set(workspaceId, sockets);
    }
    const existing = sockets.get(socketId);
    sockets.set(socketId, {
      user: { ...user },
      focus: existing ? existing.focus : null,
      focusAt: existing ? existing.focusAt : 0,
    });
  },

  leave(workspaceId: string, socketId: string): void {
    const sockets = workspaces.get(workspaceId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) workspaces.delete(workspaceId);
  },

  setFocus(workspaceId: string, socketId: string, focus: Focus | null): void {
    const entry = workspaces.get(workspaceId)?.get(socketId);
    if (!entry) return;
    entry.focus = focus ? { kind: focus.kind, id: focus.id } : null;
    entry.focusAt = ++clock;
  },

  /** One entry per user. `focus` is the most recently set non-null focus across that user's sockets. */
  members(workspaceId: string): PresenceMember[] {
    const sockets = workspaces.get(workspaceId);
    if (!sockets) return [];
    const byUser = new Map<string, { member: PresenceMember; focusAt: number }>();
    for (const entry of sockets.values()) {
      const current = byUser.get(entry.user.userId);
      if (!current) {
        byUser.set(entry.user.userId, {
          member: { ...entry.user, focus: entry.focus },
          focusAt: entry.focus ? entry.focusAt : -1,
        });
      } else if (entry.focus && entry.focusAt > current.focusAt) {
        current.member.focus = entry.focus;
        current.focusAt = entry.focusAt;
      }
    }
    return Array.from(byUser.values()).map((v) => v.member);
  },

  /** Removes the socket from every workspace and returns the ids of the workspaces it was in. */
  removeSocket(socketId: string): string[] {
    const affected: string[] = [];
    for (const [workspaceId, sockets] of workspaces) {
      if (sockets.delete(socketId)) {
        affected.push(workspaceId);
        if (sockets.size === 0) workspaces.delete(workspaceId);
      }
    }
    return affected;
  },

  socketsOfUser(workspaceId: string, userId: string): string[] {
    const sockets = workspaces.get(workspaceId);
    if (!sockets) return [];
    const result: string[] = [];
    for (const [socketId, entry] of sockets) {
      if (entry.user.userId === userId) result.push(socketId);
    }
    return result;
  },

  /** Forgets everyone in a workspace (used when it is deleted). */
  dropWorkspace(workspaceId: string): void {
    workspaces.delete(workspaceId);
  },

  reset(): void {
    workspaces.clear();
    clock = 0;
  },
};
