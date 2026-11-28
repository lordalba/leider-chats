import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt";

// Never rejects: sockets without a valid token simply have no userId,
// so the existing (unauthenticated) chat flows keep working.
export function socketAuth(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token;
  if (typeof token === "string" && token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
      if (decoded && typeof decoded.userId === "string") {
        socket.data.userId = decoded.userId;
      }
    } catch {
      // invalid token: stay unauthenticated
    }
  }
  next();
}

export function requireUserId(socket: Socket): string {
  const userId = socket.data.userId;
  if (!userId) throw new Error("unauthenticated");
  return userId;
}
