import { hasUsableToken } from "../workspaces/socketCall";

/**
 * On page load, turn the token kept in localStorage back into a logged-in
 * session: the user object in the store lives only in memory, so without
 * this every refresh looked like a logout.
 *
 * Resolves:
 *  - "anonymous": no usable token, nobody to restore;
 *  - "restored":  user loaded and the socket reconnected;
 *  - "expired":   the server rejected the token, the session was cleared;
 *  - "offline":   the server could not be reached, the token is kept so the
 *                 next refresh can try again.
 */
export async function restoreSession({ token, fetchUser, setUser, connect, clear }) {
  if (!hasUsableToken(token)) return "anonymous";

  let user;
  try {
    const response = await fetchUser();
    user = response && response.data;
  } catch (error) {
    const status = error && error.response && error.response.status;
    if (status === 401 || status === 403) {
      clear();
      return "expired";
    }
    console.warn("Could not restore the session:", error);
    return "offline";
  }

  if (!user) {
    clear();
    return "expired";
  }
  // The user first: initializeSocket emits "userOnline" with its id.
  setUser(user);
  connect();
  return "restored";
}
