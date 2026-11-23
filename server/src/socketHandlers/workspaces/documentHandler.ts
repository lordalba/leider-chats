import { Server, Socket } from "socket.io";
import {
  assertDocumentMember,
  createDocument,
  deleteDocument,
  renameDocument,
} from "../../services/workspaces/DocumentService";
import { WorkspaceError, toObjectId } from "../../services/workspaces/WorkspaceAccess";
import { yDocManager } from "../../services/workspaces/mongoYDocStore";
import { withAck } from "./withAck";
import { docRoom, wsRoom } from "./rooms";

/** Socket.IO delivers binary as Buffer (Node) or ArrayBuffer; normalize to Uint8Array. */
export const toUint8Array = (value: unknown): Uint8Array => {
  if (Buffer.isBuffer(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new WorkspaceError("invalid");
};

const documentHandler = (io: Server, socket: Socket) => {
  const emitItem = (workspaceId: string, action: string, item: unknown) => {
    io.to(wsRoom(workspaceId)).emit("workspace:item", { workspaceId, kind: "document", action, item });
  };

  socket.on(
    "doc:create",
    withAck(socket, async (userId, workspaceId: string, title: string) => {
      const { workspaceId: wsId, ...meta } = await createDocument(userId, workspaceId, title);
      emitItem(wsId, "created", meta);
      return meta;
    })
  );

  socket.on(
    "doc:rename",
    withAck(socket, async (userId, docId: string, title: string) => {
      const { workspaceId, ...meta } = await renameDocument(userId, docId, title);
      emitItem(workspaceId, "updated", meta);
      return meta;
    })
  );

  socket.on(
    "doc:delete",
    withAck(socket, async (userId, docId: string) => {
      const { workspaceId, docId: id } = await deleteDocument(userId, docId);
      emitItem(workspaceId, "deleted", { _id: id });
      io.in(docRoom(id)).socketsLeave(docRoom(id));
      return null;
    })
  );

  socket.on(
    "doc:open",
    withAck(socket, async (userId, docId: string) => {
      const { docId: id } = await assertDocumentMember(userId, docId);
      const update = await yDocManager.open(id, socket.id);
      socket.join(docRoom(id));
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
    withAck(socket, async (_userId, docId: string, rawUpdate: unknown) => {
      const id = String(toObjectId(docId));
      // Membership was checked at doc:open; eviction removes the socket from this room.
      if (!socket.rooms.has(docRoom(id))) throw new WorkspaceError("forbidden");
      const update = toUint8Array(rawUpdate);
      yDocManager.applyUpdate(id, update);
      socket.to(docRoom(id)).emit("doc:update", { docId: id, update });
      return null;
    })
  );

  // Cursor/selection awareness: no ack, volatile, never persisted.
  socket.on("doc:awareness", (docId: unknown, rawUpdate: unknown) => {
    try {
      const id = String(toObjectId(docId));
      if (!socket.rooms.has(docRoom(id))) return;
      const update = toUint8Array(rawUpdate);
      socket.to(docRoom(id)).volatile.emit("doc:awareness", { docId: id, update });
    } catch {
      // Ignore malformed awareness messages.
    }
  });
};

export default documentHandler;
