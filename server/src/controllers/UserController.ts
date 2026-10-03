import { Request, Response } from "express";
import User from "../models/User";
import { MyUserRequest } from "../types/express";
import { OnlineUserService } from "../services/OnlineUserService";
import { Types } from "mongoose";

export const addFriendRequest = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  const { friendId } = req.body;

  if (!friendId) {
    return res.status(400).json({ message: "Friend ID is required." });
  }

  if (!req.userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    if (
      !Types.ObjectId.isValid(req.userId) ||
      !Types.ObjectId.isValid(friendId)
    ) {
      return res.status(400).json({ message: "Invalid user ID or friend ID." });
    }

    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ message: "Friend not found." });
    }

    friend.friendRequests.push(new Types.ObjectId(req.userId));
    await friend.save();

    return res
      .status(200)
      .json({ message: "Friend request sent successfully." });
  } catch (error) {
    console.error("Error adding friend request:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const addFriend = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  const { friendId } = req.body;
  if (!friendId) {
    return res.status(400).json({ message: "Friend ID is required." });
  }

  if (!req.userId) {
    return res.status(400).json({ message: "User ID is required." });
  }
  try {
    const user = await User.findById(req.userId);
    const friend = await User.findById(friendId);

    if (
      !Types.ObjectId.isValid(req.userId) ||
      !Types.ObjectId.isValid(friendId)
    ) {
      return res.status(400).json({ message: "Invalid user ID or friend ID." });
    }

    if (!friend) {
      return res.status(404).json({ message: "Friend not found." });
    }

    const userId = new Types.ObjectId(req.userId);

    user?.friends.push(new Types.ObjectId(friendId));
    friend?.friends.push(userId);

    await User.updateOne(
      { _id: req.userId },
      { $pull: { friendRequests: friendId } }
    );

    await user?.save();
    await friend?.save();

    await createFriendsChatRoom(userId, friendId);

    return res.status(200).json({ message: "Friend added successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const fetchFriendRequests = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "friendRequests",
      select: "username profilePictureUrl",
      model: "User",
    });

    return res.status(200).json(user?.friendRequests);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const removeFriendRequest = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  const { friendId } = req.body;

  try {
    const user = await User.findById(req.userId);

    await User.updateOne(
      { _id: req.userId },
      { $pull: { friendRequests: friendId } }
    );

    await user?.save();

    return res.status(200).json({
      message: `Friend request for user ${friendId} is removed successfully.`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.query;

    const trimmedSearchTerm =
      typeof searchTerm === "string" ? searchTerm.trim() : "";

    if (!trimmedSearchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }

    const regex = new RegExp(trimmedSearchTerm, "i");
    const users = await User.find({ username: regex }).limit(10);

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const fetchUserFriends = async (req: MyUserRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "friends",
      select:
        "username profilePictureUrl profession location skills lastConnected",
      model: "User",
    });

    const friends = user?.friends || [];

    const friendsWithStatus = friends.map((friend: any) => ({
      ...friend.toObject(),
      isOnline: OnlineUserService.getOnlineUsers()[String(friend._id)]
        ? true
        : false,
    }));

    res.status(200).json(friendsWithStatus);
  } catch (error) {
    console.error("Error fetching friends:", error);
    res.status(500).json({ error: "Error fetching friends" });
  }
};

const createFriendsChatRoom = async (
  userId: Types.ObjectId,
  friendId: Types.ObjectId
) => {
  const friendIds = [];
  friendIds.push(userId);
  friendIds.push(friendId);
  // await createChatRoom(friendIds);
};
