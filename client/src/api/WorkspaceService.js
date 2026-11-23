import httpClient from "./httpClient";

// Reads only. Workspace writes go over the socket (see src/socket/socketCall.js).

export const fetchWorkspaces = (chatRoomId) =>
  httpClient.get("/workspaces", { params: chatRoomId ? { chatRoomId } : {} });

export const fetchWorkspace = (workspaceId) => httpClient.get(`/workspaces/${workspaceId}`);
