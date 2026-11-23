export const ACK_TIMEOUT_MS = 10000;

/**
 * Emits a workspace event and waits for its ack.
 * Resolves with `data` on `{ok:true}`, rejects with `Error(code)` on `{ok:false}`,
 * and rejects with `Error("timeout")` when no ack arrives within 10 s.
 */
export function emitWithAck(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error("not_connected"));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, ACK_TIMEOUT_MS);

    socket.emit(event, ...args, (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (res && res.ok) resolve(res.data);
      else reject(new Error((res && res.error) || "server_error"));
    });
  });
}

const MESSAGES = {
  unauthenticated: "Your session expired. Please log in again.",
  forbidden: "You don't have permission to do that.",
  not_found: "That item no longer exists.",
  invalid: "Some of the values aren't valid.",
  board_full: "This whiteboard is full.",
  timeout: "The server didn't respond. Check your connection.",
  not_connected: "You're not connected. Please log in.",
  server_error: "Something went wrong on the server.",
};

export function errorMessage(err) {
  const code = err && err.message;
  return MESSAGES[code] || MESSAGES.server_error;
}
