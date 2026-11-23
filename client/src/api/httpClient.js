import axios from "axios";
import { getToken } from "@/auth/tokenStorage";

export const SERVER_URL = "http://localhost:3000";
export const API_BASE_URL = `${SERVER_URL}/api`;

/** The one HTTP client for the server API. Adds the login token to every request. */
const httpClient = axios.create({ baseURL: API_BASE_URL });

httpClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** The server's error message from a failed request, or a generic one. */
export const serverMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const data = error && error.response && error.response.data;
  return (data && (data.message || data.error)) || fallback;
};

export default httpClient;
