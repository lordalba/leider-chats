import axios from "axios";

const API_URL = "http://localhost:3000/api/personal";

export const fetchUserData = async () => {
    const token = getAuthToken();
  
    return await axios.get(`${API_URL}/get`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  };

export const updateProfile = async (formData) => {
  const token = getAuthToken();

  return await axios.put(`${API_URL}/update-profile`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
};

const getAuthToken = () => {
  return localStorage.getItem("token");
};
