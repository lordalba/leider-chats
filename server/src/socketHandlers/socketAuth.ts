import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt";

/**
 * Reads `handshake.auth.token` and, when it is a valid JWT, stores the user id on `socket.data.userId`.
 * Never rejects the connection, so the existing chat flows keep working without a token.
 */
export const socketAuth = (socket: Socket, next: (err?: Error) => void): void => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (typeof token === "string" && token.length > 0) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: unknown };
      if (decoded && typeof decoded.userId === "string") {
        socket.data.userId = decoded.userId;
      }
    } catch {
      // Invalid or expired token: the socket stays unauthenticated.
    }
  }
  next();
};

export const requireUserId = (socket: Socket): string => {
  const userId = socket.data && socket.data.userId;
  if (typeof userId !== "string") throw new Error("unauthenticated");
  return userId;
};
