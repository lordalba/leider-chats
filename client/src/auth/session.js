import Vue from "vue";
import store from "@/store/store";
import { SESSION_EXPIRED_MESSAGE } from "@/workspaces/taskBoard";

/**
 * Log the current user out locally: drop the token and user, and tear down
 * the socket so the next login creates a fresh one with the new token
 * (initializeSocket only creates a socket when none is set).
 */
export function clearSession() {
  localStorage.removeItem("token");
  store.dispatch("setConnectedUser", undefined);
  const socket = store.getters["socket/socket"];
  if (socket) socket.disconnect();
  store.commit("socket/SET_SOCKET", null);
}

let handlingExpiry = false;

/**
 * The server refused an event because the socket carries no valid token
 * (JWTs expire): tell the user, log out locally and send them to /login.
 * Concurrent triggers (several refused events) collapse into one.
 */
export async function handleSessionExpired() {
  if (handlingExpiry) return;
  handlingExpiry = true;
  try {
    if (Vue.$toast) Vue.$toast.error(SESSION_EXPIRED_MESSAGE);
    clearSession();
    // Imported lazily: router.js pulls in every view, and views import the store.
    const { default: router } = await import("@/router.js");
    if (router.currentRoute.path !== "/login") {
      router.push("/login").catch(() => {});
    }
  } catch (error) {
    console.error("session expiry handling failed:", error);
  } finally {
    handlingExpiry = false;
  }
}
