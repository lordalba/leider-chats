import http from "http";
import { AddressInfo } from "net";
import { Server, Socket } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../src/config/jwt";
import { socketAuth } from "../../src/socketHandlers/socketAuth";

export async function startTestServer(
  register: (io: Server, socket: Socket) => void
): Promise<{ url: string; io: Server; close(): Promise<void> }> {
  const httpServer = http.createServer();
  const io = new Server(httpServer);
  io.use(socketAuth);
  io.on("connection", (socket) => register(io, socket));

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    io,
    close: async () => {
      await io.close();
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    },
  };
}

export function connectAs(
  url: string,
  userId: string | null
): Promise<ClientSocket> {
  const auth = userId ? { token: jwt.sign({ userId }, JWT_SECRET) } : {};
  const socket = ioClient(url, {
    auth,
    transports: ["websocket"],
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}
