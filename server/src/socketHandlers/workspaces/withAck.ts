import { Socket } from "socket.io";
import mongoose from "mongoose";
import { WorkspaceError } from "../../services/workspaces/WorkspaceAccess";
import { requireUserId } from "../socketAuth";

export type AckResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
export type AckFn = (result: AckResult) => void;

const toErrorCode = (err: unknown): string => {
  if (err instanceof WorkspaceError) return err.code;
  if (err instanceof Error && err.message === "unauthenticated") return "unauthenticated";
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    return "invalid";
  }
  console.error("[workspaces] unexpected socket handler error:", err);
  return "server_error";
};

/**
 * Wraps a socket event handler. The ack callback is taken from the last argument when it is a function.
 * Resolves to `{ok:true, data}` or `{ok:false, error: code}`. Never throws.
 */
export const withAck = <A extends unknown[], T>(
  socket: Socket,
  fn: (userId: string, ...args: A) => Promise<T>
) => {
  return (...raw: unknown[]): void => {
    const last = raw[raw.length - 1];
    const ack = typeof last === "function" ? (raw.pop() as AckFn) : undefined;

    Promise.resolve()
      .then(() => {
        const userId = requireUserId(socket);
        return fn(userId, ...(raw as A));
      })
      .then(
        (data) => {
          if (ack) ack({ ok: true, data: data === undefined ? null : data });
        },
        (err) => {
          const error = toErrorCode(err);
          if (ack) ack({ ok: false, error });
        }
      )
      .catch((err) => console.error("[workspaces] ack callback failed:", err));
  };
};
