import express from "express";
import {
  createChatroom,
  getChatMessages,
  getRelatedChatroomsWithFriend,
  getUserChats,
} from "../../controllers/chatrooms/ChatRoomsController";
import { authenticate } from "../../middlewares/AuthMiddleware";
import { imageOnlyUpload } from "../../utils/uploads";

const router = express.Router();
const groupPictureUpload = imageOnlyUpload("chatImage", 5, "Only images can be used as a group picture.");

router.get("/get", authenticate, getUserChats);
router.get("/messages/:chatRoomId", authenticate, getChatMessages);
router.get("/related/:friendId", authenticate, getRelatedChatroomsWithFriend);
router.post("/create", authenticate, groupPictureUpload, createChatroom);

// Admin settings (e.g. "only admins can send messages") are changed over the socket,
// where the server checks that the sender is an admin.

export default router;
