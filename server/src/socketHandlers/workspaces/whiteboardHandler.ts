import { Server, Socket } from "socket.io";
import {
  addStroke,
  clearWhiteboard,
  createWhiteboard,
  deleteWhiteboard,
  getStrokes,
  renameWhiteboard,
  undoStroke,
} from "../../services/workspaces/WhiteboardService";
import { WorkspaceError, toObjectId } from "../../services/workspaces/WorkspaceAccess";
import {
  isValidColor,
  isValidPoints,
  isValidStrokeId,
  isValidWidth,
} from "../../services/workspaces/strokeValidation";
import { withAck } from "./withAck";
import { wbRoom, wsRoom } from "./rooms";

const whiteboardHandler = (io: Server, socket: Socket) => {
  const emitItem = (workspaceId: string, action: string, item: unknown) => {
    io.to(wsRoom(workspaceId)).emit("workspace:item", { workspaceId, kind: "whiteboard", action, item });
  };

  /** Returns the canonical id if this socket has the board open, otherwise throws `forbidden`. */
  const requireOpen = (whiteboardId: unknown): string => {
    const id = String(toObjectId(whiteboardId));
    if (!socket.rooms.has(wbRoom(id))) throw new WorkspaceError("forbidden");
    return id;
  };

  socket.on(
    "wb:create",
    withAck(socket, async (userId, workspaceId: string, title: string) => {
      const { workspaceId: wsId, ...meta } = await createWhiteboard(userId, workspaceId, title);
      emitItem(wsId, "created", meta);
      return meta;
    })
  );

  socket.on(
    "wb:rename",
    withAck(socket, async (userId, whiteboardId: string, title: string) => {
      const { workspaceId, ...meta } = await renameWhiteboard(userId, whiteboardId, title);
      emitItem(workspaceId, "updated", meta);
      return meta;
    })
  );

  socket.on(
    "wb:delete",
    withAck(socket, async (userId, whiteboardId: string) => {
      const { workspaceId, whiteboardId: id } = await deleteWhiteboard(userId, whiteboardId);
      emitItem(workspaceId, "deleted", { _id: id });
      io.in(wbRoom(id)).socketsLeave(wbRoom(id));
      return null;
    })
  );

  socket.on(
    "wb:open",
    withAck(socket, async (userId, whiteboardId: string) => {
      const strokes = await getStrokes(userId, whiteboardId);
      socket.join(wbRoom(String(toObjectId(whiteboardId))));
      return { strokes };
    })
  );

  socket.on(
    "wb:close",
    withAck(socket, async (_userId, whiteboardId: string) => {
      socket.leave(wbRoom(String(toObjectId(whiteboardId))));
      return null;
    })
  );

  // In-progress stroke preview: no ack, volatile, never persisted.
  socket.on("wb:drawing", (whiteboardId: unknown, payload: unknown) => {
    try {
      const id = requireOpen(whiteboardId);
      if (!payload || typeof payload !== "object") return;
      const { strokeId, color, width, points } = payload as Record<string, unknown>;
      if (!isValidStrokeId(strokeId) || !isValidColor(color) || !isValidWidth(width) || !isValidPoints(points)) {
        return;
      }
      socket.to(wbRoom(id)).volatile.emit("wb:drawing", {
        whiteboardId: id,
        userId: socket.data.userId,
        strokeId,
        color,
        width,
        points,
      });
    } catch {
      // Ignore malformed or unauthorized previews.
    }
  });

  socket.on(
    "wb:stroke",
    withAck(socket, async (userId, whiteboardId: string, input: unknown) => {
      const id = requireOpen(whiteboardId);
      const stroke = await addStroke(userId, id, input);
      socket.to(wbRoom(id)).emit("wb:stroke", { whiteboardId: id, stroke });
      return stroke;
    })
  );

  socket.on(
    "wb:undo",
    withAck(socket, async (userId, whiteboardId: string, strokeId: string) => {
      const id = requireOpen(whiteboardId);
      await undoStroke(userId, id, strokeId);
      io.to(wbRoom(id)).emit("wb:stroke-removed", { whiteboardId: id, strokeId });
      return null;
    })
  );

  socket.on(
    "wb:clear",
    withAck(socket, async (userId, whiteboardId: string) => {
      const id = requireOpen(whiteboardId);
      await clearWhiteboard(userId, id);
      io.to(wbRoom(id)).emit("wb:cleared", { whiteboardId: id });
      return null;
    })
  );
};

export default whiteboardHandler;
