import axios from "axios";

const API_URL = "http://localhost:3000/api/chatrooms";

export const fetchChatRooms = async () => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/get`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const fetchChatMessages = async (chatroomId) => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/messages/${chatroomId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const fetchRelatedChatrooms = async (friendId) => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/related/${friendId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const createChatroom = async (chatroom) => {
  const token = getAuthToken();

  const response = await axios.post(`${API_URL}/create`, chatroom, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });

  return response;
};

const getAuthToken = () => {
  return localStorage.getItem("token");
};
