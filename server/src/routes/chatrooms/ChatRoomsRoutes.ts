import express from "express";
import {
  getUserChats,
  getChatMessages,
  getRelatedChatroomsWithFriend,
  createChatroom,
  updateAdminPermissions,
} from "../../controllers/chatrooms/ChatRoomsController";
import { authenticate } from "../../middlewares/AuthMiddleware";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/get", authenticate, getUserChats);

router.get("/messages/:chatRoomId", authenticate, getChatMessages);

router.get("/related/:friendId", authenticate, getRelatedChatroomsWithFriend);

router.post(
  "/create",
  authenticate,
  upload.single("chatImage"),
  createChatroom
);

router.patch("/update-permissions", updateAdminPermissions);

export default router;
