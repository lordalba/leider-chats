import { Server, Socket } from "socket.io";
import { withAck } from "./withAck";
import { docRoom, wsRoom } from "./rooms";
import { WorkspaceError, toObjectId } from "../../services/workspaces/WorkspaceAccess";
import { yDocManager } from "../../services/workspaces/YDocManager";
import {
  assertDocumentMember,
  createDocument,
  deleteDocument,
  documentExists,
  renameDocument,
} from "../../services/workspaces/DocumentService";

// Awareness frames are tiny (cursor + name); cap them so a client can't use
// the relay to flood other members.
const AWARENESS_MAX_BYTES = 64 * 1024;

const emitItem = (
  io: Server,
  workspaceId: string,
  action: "created" | "updated" | "deleted",
  item: unknown
) => {
  io.to(wsRoom(workspaceId)).emit("workspace:item", {
    workspaceId,
    kind: "document",
    action,
    item,
  });
};

/** Socket.IO delivers binary as a Buffer (or ArrayBuffer); anything else is invalid. */
function toUpdate(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return new Uint8Array(raw);
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  throw new WorkspaceError("invalid");
}

const documentHandler = (io: Server, socket: Socket) => {
  socket.on(
    "doc:create",
    withAck(socket, async (userId, workspaceId: string, title: string) => {
      const meta = await createDocument(userId, workspaceId, title);
      emitItem(io, String(workspaceId), "created", meta);
      return meta;
    })
  );

  socket.on(
    "doc:rename",
    withAck(socket, async (userId, docId: string, title: string) => {
      const { workspaceId, ...meta } = await renameDocument(userId, docId, title);
      emitItem(io, workspaceId, "updated", meta);
      return meta;
    })
  );

  socket.on(
    "doc:delete",
    withAck(socket, async (userId, docId: string) => {
      const { workspaceId } = await deleteDocument(userId, docId);
      io.in(docRoom(String(docId))).socketsLeave(docRoom(String(docId)));
      emitItem(io, workspaceId, "deleted", { _id: String(docId) });
      return null;
    })
  );

  socket.on(
    "doc:open",
    withAck(socket, async (userId, docId: string) => {
      await assertDocumentMember(userId, docId);
      const id = String(docId);
      socket.join(docRoom(id));
      const update = await yDocManager.open(id, socket.id);
      // Re-check after joining: an eviction or a delete may have landed while
      // the doc was loading (eviction's leave would have run before our join).
      try {
        await assertDocumentMember(userId, id);
      } catch (error) {
        socket.leave(docRoom(id));
        if (await documentExists(id)) await yDocManager.close(id, socket.id);
        else yDocManager.delete(id);
        throw error;
      }
      return { update };
    })
  );

  socket.on(
    "doc:close",
    withAck(socket, async (_userId, docId: string) => {
      const id = String(toObjectId(docId));
      socket.leave(docRoom(id));
      await yDocManager.close(id, socket.id);
      return null;
    })
  );

  socket.on(
    "doc:update",
    withAck(socket, async (_userId, docId: string, raw: unknown) => {
      const id = String(toObjectId(docId));
      // Membership was checked at doc:open; eviction removes the socket from the room.
      if (!socket.rooms.has(docRoom(id))) throw new WorkspaceError("forbidden");
      const update = toUpdate(raw);
      yDocManager.applyUpdate(id, update);
      socket.to(docRoom(id)).emit("doc:update", { docId: id, update });
      return null;
    })
  );

  socket.on("doc:awareness", (docId: unknown, raw: unknown) => {
    if (typeof docId !== "string" || !socket.rooms.has(docRoom(docId))) return;
    if (!(raw instanceof Uint8Array || raw instanceof ArrayBuffer)) return;
    if (raw.byteLength > AWARENESS_MAX_BYTES) return;
    socket.to(docRoom(docId)).volatile.emit("doc:awareness", { docId, update: raw });
  });
};

export default documentHandler;
