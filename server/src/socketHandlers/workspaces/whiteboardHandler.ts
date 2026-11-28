import { Server, Socket } from "socket.io";
import { withAck } from "./withAck";
import { wbRoom, wsRoom } from "./rooms";
import { WorkspaceError, toObjectId } from "../../services/workspaces/WorkspaceAccess";
import {
  addStroke,
  assertWhiteboardMember,
  clearWhiteboard,
  createWhiteboard,
  deleteWhiteboard,
  getStrokes,
  renameWhiteboard,
  undoStroke,
} from "../../services/workspaces/WhiteboardService";
import { validateStroke } from "../../services/workspaces/strokeValidation";

const emitItem = (
  io: Server,
  workspaceId: string,
  action: "created" | "updated" | "deleted",
  item: unknown
) => {
  io.to(wsRoom(workspaceId)).emit("workspace:item", {
    workspaceId,
    kind: "whiteboard",
    action,
    item,
  });
};

/** Room-gated events: membership was checked at wb:open; eviction removes the socket. */
function requireOpen(socket: Socket, whiteboardId: unknown): string {
  const id = String(toObjectId(whiteboardId));
  if (!socket.rooms.has(wbRoom(id))) throw new WorkspaceError("forbidden");
  return id;
}

const whiteboardHandler = (io: Server, socket: Socket) => {
  socket.on(
    "wb:create",
    withAck(socket, async (userId, workspaceId: string, title: string) => {
      const meta = await createWhiteboard(userId, workspaceId, title);
      emitItem(io, String(workspaceId), "created", meta);
      return meta;
    })
  );

  socket.on(
    "wb:rename",
    withAck(socket, async (userId, whiteboardId: string, title: string) => {
      const { workspaceId, ...meta } = await renameWhiteboard(userId, whiteboardId, title);
      emitItem(io, workspaceId, "updated", meta);
      return meta;
    })
  );

  socket.on(
    "wb:delete",
    withAck(socket, async (userId, whiteboardId: string) => {
      const { workspaceId } = await deleteWhiteboard(userId, whiteboardId);
      const room = wbRoom(String(whiteboardId));
      io.in(room).socketsLeave(room);
      emitItem(io, workspaceId, "deleted", { _id: String(whiteboardId) });
      return null;
    })
  );

  socket.on(
    "wb:open",
    withAck(socket, async (userId, whiteboardId: string) => {
      await assertWhiteboardMember(userId, whiteboardId);
      const id = String(whiteboardId);
      // Join before reading: a stroke landing in between arrives both as an
      // event and in the snapshot, and the client dedups by stroke id.
      socket.join(wbRoom(id));
      try {
        return { strokes: await getStrokes(userId, id) };
      } catch (error) {
        socket.leave(wbRoom(id));
        throw error;
      }
    })
  );

  socket.on(
    "wb:close",
    withAck(socket, async (_userId, whiteboardId: string) => {
      socket.leave(wbRoom(String(toObjectId(whiteboardId))));
      return null;
    })
  );

  socket.on(
    "wb:stroke",
    withAck(socket, async (userId, whiteboardId: string, input: unknown) => {
      const id = requireOpen(socket, whiteboardId);
      const stroke = await addStroke(userId, id, input);
      socket.to(wbRoom(id)).emit("wb:stroke", { whiteboardId: id, stroke });
      return stroke;
    })
  );

  socket.on(
    "wb:undo",
    withAck(socket, async (userId, whiteboardId: string, strokeId: string) => {
      const id = requireOpen(socket, whiteboardId);
      await undoStroke(userId, id, strokeId);
      io.to(wbRoom(id)).emit("wb:stroke-removed", { whiteboardId: id, strokeId });
      return null;
    })
  );

  socket.on(
    "wb:clear",
    withAck(socket, async (userId, whiteboardId: string) => {
      const id = String(toObjectId(whiteboardId));
      await clearWhiteboard(userId, id);
      io.to(wbRoom(id)).emit("wb:cleared", { whiteboardId: id });
      return null;
    })
  );

  // In-progress strokes: relayed (volatile) to the board, never stored.
  socket.on("wb:drawing", (whiteboardId: unknown, input: unknown) => {
    const userId = socket.data.userId;
    if (!userId || typeof whiteboardId !== "string") return;
    if (!socket.rooms.has(wbRoom(whiteboardId))) return;
    if (typeof input !== "object" || input === null) return;
    const raw = input as Record<string, unknown>;
    let live;
    try {
      live = validateStroke({ ...raw, id: raw.strokeId }, String(userId));
    } catch {
      return;
    }
    socket.to(wbRoom(whiteboardId)).volatile.emit("wb:drawing", {
      whiteboardId,
      userId: live.userId,
      strokeId: live.id,
      color: live.color,
      width: live.width,
      points: live.points,
    });
  });
};

export default whiteboardHandler;
