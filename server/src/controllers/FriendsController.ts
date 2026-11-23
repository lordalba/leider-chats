import { Response } from "express";
import { MyUserRequest } from "../types/express";
import { asyncHandler } from "../http/asyncHandler";
import { friendshipService } from "../services/FriendshipService";

/** HTTP layer for friends and user search. The rules live in FriendshipService. */

export const addFriendRequest = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  await friendshipService.sendRequest(String(req.userId), req.body.friendId);
  res.status(200).json({ message: "Friend request sent." });
});

export const addFriend = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  await friendshipService.acceptRequest(String(req.userId), req.body.friendId);
  res.status(200).json({ message: "Friend added." });
});

export const removeFriendRequest = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  await friendshipService.declineRequest(String(req.userId), req.body.friendId);
  res.status(200).json({ message: "Friend request removed." });
});

export const removeFriend = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  await friendshipService.removeFriend(String(req.userId), req.body.friendId);
  res.status(200).json({ message: "Friend removed." });
});

export const fetchFriendRequests = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  res.status(200).json(await friendshipService.listRequests(String(req.userId)));
});

export const fetchUserFriends = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  res.status(200).json(await friendshipService.listFriends(String(req.userId)));
});

export const searchUsers = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  res.status(200).json(await friendshipService.searchUsers(req.query.query));
});
