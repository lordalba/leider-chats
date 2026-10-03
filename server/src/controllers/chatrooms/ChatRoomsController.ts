import { MyUserRequest } from "../../types/express";
import { Response } from "express";
import mongoose from "mongoose";
import {
  fetchUserChats,
  fetchChatMessages,
  fetchUsersRelatedChats,
  fetchUnreadMessagesCount,
  patchAdminPermissions
} from "../../services/ChatRoomService";
import { createChatRoom } from "../../services/ChatRoomService";
import path from "path";
import fs from "fs";

export const getUserChats = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const userChatRooms = await fetchUserChats(userId);

    const chatroomsWithUnreadMessagesCount = await Promise.all(
      userChatRooms.map(async (chatroom: any) => ({
        ...chatroom.toObject(),
        unreadMessages: await fetchUnreadMessagesCount(chatroom._id, userId),
      }))
    );

    return res.status(200).json(chatroomsWithUnreadMessagesCount);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getChatMessages = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  try {
    let chatRoomId = new mongoose.Types.ObjectId(req.params.chatRoomId);

    const chatMessages = await fetchChatMessages(chatRoomId);

    return res.status(200).json(chatMessages);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getRelatedChatroomsWithFriend = async (
  req: MyUserRequest,
  res: Response
) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const friendId = new mongoose.Types.ObjectId(req.params.friendId);
    console.log("in ze related when userId iz: " + JSON.stringify(userId)  + " and friend " + JSON.stringify(friendId));
    const relatedChats = await fetchUsersRelatedChats(userId, friendId);

    return res.status(200).json(relatedChats);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const createChatroom = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  try {
    const { participants, name } = req.body;
    const imageUrl = handleFileSaving(req);
    const chat = await createChatRoom(JSON.parse(participants), name, imageUrl, new mongoose.Types.ObjectId(req.userId));
    console.log("chatroom for send: " + JSON.stringify(chat))
    return res.status(200).json(chat);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const updateAdminPermissions = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  try {
    const { chatRoomId, newAdminPermissions } = req.body;
    await patchAdminPermissions(new mongoose.Types.ObjectId(chatRoomId), newAdminPermissions);
    return res.status(200).json("admin permissions updated in chatroom: " + chatRoomId + "are set to " + newAdminPermissions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

const handleFileSaving = (req: MyUserRequest) => {
  if (req.file) {
    const fileExtension = path.extname(req.file.originalname);
    const newFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
    const uploadPath = path.join(
      __dirname,
      `../../uploads/chatrooms`,
      newFileName
    );

    // Rename and move the uploaded file
    fs.rename(req.file.path, uploadPath, (err) => {
      if (err) throw err;
    });

    let chatroomImageUrl = `${process.env.SERVER_BASE_URL}${process.env.PORT}/uploads/chatrooms/${newFileName}`;

    return chatroomImageUrl;
  }

  return null;
};
