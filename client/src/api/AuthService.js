import httpClient, { serverMessage } from "./httpClient";

export async function registerUser(userData) {
  try {
    const { data } = await httpClient.post("/auth/register", userData);
    return data;
  } catch (error) {
    throw new Error(serverMessage(error, "Registration failed"));
  }
}

/** Resolves with `{ token }`. Rejects with the server's message (e.g. "Invalid credentials."). */
export async function loginUser(credentials) {
  try {
    const { data } = await httpClient.post("/auth/login", credentials);
    return data;
  } catch (error) {
    throw new Error(serverMessage(error, "Login failed"));
  }
}
