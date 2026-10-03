import axios from "axios";

const API_URL = "http://localhost:3000/api/users";

export const searchUsers = async (searchTerm) => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/search?query=${searchTerm}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const fetchFriends = async () => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/friends/get`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const fetchFriendRequests = async () => {
  const token = getAuthToken();

  return await axios.get(`${API_URL}/friend-requests/get`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const addFriend = async (friendUserId) => {
  const token = getAuthToken();

  return await axios.post(`${API_URL}/add-friend`, { friendId: friendUserId } ,{
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const removeFriendRequest = async (friendUserId) => {
  const token = getAuthToken();

  return await axios.post(`${API_URL}/remove-friend-request`, { friendId: friendUserId } ,{
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const addFriendReqest = async (friendUserId) => {
  const token = getAuthToken();

  return await axios.post(`${API_URL}/add-friend-request`, { friendId: friendUserId } ,{
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

const getAuthToken = () => {
  return localStorage.getItem("token");
};
