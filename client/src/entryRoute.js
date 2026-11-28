// Leider chats has no home page: "/" opens the chats, or the login page
// when nobody is logged in. Decided by the stored token, which exists on a
// refresh before the user object has been fetched.
export function entryPath(token) {
  return token ? "/chatrooms" : "/login";
}
