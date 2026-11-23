const TOKEN_KEY = "token";

/** The saved login token, or null. (Older logouts stored the string "null".) */
export const getToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token && token !== "null" && token !== "undefined" ? token : null;
};

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
