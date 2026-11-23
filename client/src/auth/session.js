import store from "@/store/store";
import httpClient from "@/api/httpClient";
import { fetchUserData } from "@/api/PersonalService";
import { clearToken, getToken, setToken } from "./tokenStorage";

export const isLoggedIn = () => !!store.state.connectedUser;

/** Loads the user for the saved token and connects the socket. */
async function loadSessionUser() {
  const { data } = await fetchUserData();
  if (!data || !data._id) throw new Error("No user for this token");
  await store.dispatch("setConnectedUser", data);
  await store.dispatch("socket/initializeSocket");
  return data;
}

/** Starts a session right after a successful login. */
export async function startSession(token) {
  setToken(token);
  try {
    return await loadSessionUser();
  } catch (error) {
    clearToken();
    throw error;
  }
}

/** On page load: log back in with the saved token, so a refresh doesn't log you out. */
export async function restoreSession() {
  if (!getToken()) {
    clearToken();
    return false;
  }
  try {
    await loadSessionUser();
    return true;
  } catch {
    clearToken();
    return false;
  }
}

export function endSession() {
  clearToken();
  store.dispatch("socket/disconnectSocket");
  store.dispatch("setConnectedUser", undefined);
}

/** When the server rejects our token (expired or invalid), log out and go to the login page. */
export function installAuthInterceptor(router) {
  httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response && error.response.status;
      const message = error.response && error.response.data && error.response.data.message;
      const tokenRejected =
        status === 401 || (status === 403 && typeof message === "string" && message.startsWith("Invalid token"));
      if (tokenRejected && isLoggedIn()) {
        endSession();
        router.push({ path: "/login", query: { expired: "1" } }).catch(() => {});
      }
      return Promise.reject(error);
    }
  );
}
