export const ACK_TIMEOUT_MS = 10000;

/**
 * Emit a socket event whose last argument is an ack callback answering
 * `{ ok: true, data } | { ok: false, error }`.
 * Resolves `data`, rejects `Error(code)` on `ok:false`, and rejects
 * `Error("timeout")` when no ack arrives within 10000 ms.
 */
export function emitWithAck(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("timeout"));
    }, ACK_TIMEOUT_MS);

    socket.emit(event, ...args, (response) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (response && response.ok) {
        resolve(response.data);
      } else {
        reject(new Error((response && response.error) || "server_error"));
      }
    });
  });
}

/**
 * A stored token is usable only when present and not the literal "null"
 * (older logouts stored `localStorage.setItem("token", null)`).
 */
export function hasUsableToken(token) {
  return typeof token === "string" && token !== "" && token !== "null";
}

/**
 * Return the app socket, creating it first when it is missing (e.g. after a
 * page reload, since the socket is otherwise only created at login).
 */
export function ensureSocket(store) {
  let socket = store.getters["socket/socket"];
  if (!socket && hasUsableToken(localStorage.getItem("token"))) {
    try {
      store.dispatch("socket/initializeSocket");
    } catch (error) {
      // initializeSocket emits "userOnline" with connectedUser._id, which
      // throws when the user isn't loaded yet; the socket is already created.
      console.warn("initializeSocket:", error);
    }
    socket = store.getters["socket/socket"];
  }
  return socket;
}
