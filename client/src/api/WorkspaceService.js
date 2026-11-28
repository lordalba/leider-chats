import axios from "axios";

const API_URL = "http://localhost:3000/api/workspaces";

export const fetchWorkspaces = async (chatRoomId) => {
  const token = getAuthToken();

  return await axios.get(API_URL, {
    params: chatRoomId ? { chatRoomId } : {},
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const fetchWorkspace = async (id) => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

const getAuthToken = () => {
  return localStorage.getItem("token");
};
