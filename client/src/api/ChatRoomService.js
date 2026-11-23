import httpClient from "./httpClient";

export const fetchChatRooms = () => httpClient.get("/chatrooms/get");

export const fetchChatMessages = (chatroomId) => httpClient.get(`/chatrooms/messages/${chatroomId}`);

export const fetchRelatedChatrooms = (friendId) => httpClient.get(`/chatrooms/related/${friendId}`);

/**
 * `formData` holds participants (JSON array of the other people's ids), and for groups a name
 * and an optional chatImage. One other person = their private chat (reused if it exists).
 */
export const createChatroom = (formData) => httpClient.post("/chatrooms/create", formData);
