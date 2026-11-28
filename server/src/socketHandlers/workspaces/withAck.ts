import { Socket } from "socket.io";
import { WorkspaceError } from "../../services/workspaces/WorkspaceAccess";
import { requireUserId } from "../socketAuth";

export type AckError =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "board_full"
  | "server_error";

export type AckResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: AckError };

export type AckFn = (result: AckResult) => void;

export function withAck<A extends unknown[], T>(
  socket: Socket,
  fn: (userId: string, ...args: A) => Promise<T>
): (...args: [...A, AckFn?]) => void {
  return (...rawArgs: unknown[]) => {
    const last = rawArgs[rawArgs.length - 1];
    const ack: AckFn | undefined =
      typeof last === "function" ? (last as AckFn) : undefined;
    const args = (ack ? rawArgs.slice(0, -1) : rawArgs) as A;

    const reply = (result: AckResult) => {
      if (!ack) return;
      try {
        ack(result);
      } catch (e) {
        console.error("withAck: ack callback failed", e);
      }
    };

    (async () => {
      try {
        const userId = requireUserId(socket);
        const data = await fn(userId, ...args);
        reply({ ok: true, data });
      } catch (err) {
        if (err instanceof WorkspaceError) {
          reply({ ok: false, error: err.code });
        } else if (err instanceof Error && err.message === "unauthenticated") {
          reply({ ok: false, error: "unauthenticated" });
        } else {
          console.error("withAck: unexpected error", err);
          reply({ ok: false, error: "server_error" });
        }
      }
    })();
  };
}
