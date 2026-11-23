import httpClient from "./httpClient";

export const searchUsers = (searchTerm) => httpClient.get("/users/search", { params: { query: searchTerm } });

export const fetchFriends = () => httpClient.get("/users/friends/get");

export const fetchFriendRequests = () => httpClient.get("/users/friend-requests/get");

export const sendFriendRequest = (userId) => httpClient.post("/users/add-friend-request", { friendId: userId });

export const acceptFriendRequest = (userId) => httpClient.post("/users/add-friend", { friendId: userId });

export const declineFriendRequest = (userId) => httpClient.post("/users/remove-friend-request", { friendId: userId });

export const removeFriend = (userId) => httpClient.post("/users/remove-friend", { friendId: userId });
