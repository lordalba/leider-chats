import http from "http";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { JWT_SECRET } from "../../src/config/jwt";
import { socketAuth } from "../../src/socketHandlers/socketAuth";

export type { ClientSocket };
export type Ack = { ok: true; data: any } | { ok: false; error: string };

const openClients: ClientSocket[] = [];

export const startTestServer = async (
  register: (io: Server, socket: Socket) => void
): Promise<{ url: string; io: Server; close(): Promise<void> }> => {
  const httpServer = http.createServer();
  const io = new Server(httpServer, { maxHttpBufferSize: 5e6 });
  io.use(socketAuth);
  io.on("connection", (socket) => register(io, socket));
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    io,
    close: async () => {
      openClients.splice(0).forEach((c) => c.disconnect());
      await new Promise<void>((resolve) => io.close(() => resolve()));
      // Disconnect handlers write to Mongo asynchronously; let them finish before the DB goes away.
      await delay(300);
    },
  };
};

export const connectAs = (url: string, userId: string | null): Promise<ClientSocket> => {
  const auth = userId ? { token: jwt.sign({ userId }, JWT_SECRET) } : {};
  const client = ioClient(url, { auth, transports: ["websocket"], forceNew: true, reconnection: false });
  openClients.push(client);
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
};

export const emitAck = (client: ClientSocket, event: string, ...args: unknown[]): Promise<Ack> =>
  new Promise((resolve) => client.emit(event, ...args, (res: Ack) => resolve(res)));

/** Resolves with the next `event` payload matching `predicate`, or rejects after `timeoutMs`. */
export const waitFor = <T = any>(
  client: ClientSocket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 3000
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      client.off(event, handler);
      resolve(payload);
    };
    client.on(event, handler);
  });

/** Collects every `event` payload received from now on. */
export const record = <T = any>(client: ClientSocket, event: string): T[] => {
  const received: T[] = [];
  client.on(event, (payload: T) => received.push(payload));
  return received;
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
