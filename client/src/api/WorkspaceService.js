import axios from "axios";

const API_URL = "http://localhost:3000/api/workspaces";

// Reads only. Workspace writes go over the socket (see src/workspaces/socketCall.js).

export const fetchWorkspaces = async (chatRoomId) => {
  const token = getAuthToken();

  return await axios.get(API_URL, {
    params: chatRoomId ? { chatRoomId } : {},
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const fetchWorkspace = async (workspaceId) => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/${workspaceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

const getAuthToken = () => {
  return localStorage.getItem("token");
};
