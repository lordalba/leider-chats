import httpClient from "./httpClient";

export const fetchUserData = () => httpClient.get("/personal/get");

/** `formData` holds username, aboutMe, skills (JSON array) and an optional profilePicture. */
export const updateProfile = (formData) => httpClient.put("/personal/update-profile", formData);
