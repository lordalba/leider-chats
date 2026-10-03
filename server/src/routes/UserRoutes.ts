import express from "express";
import {
  addFriendRequest,
  addFriend,
  removeFriendRequest,
  searchUsers,
  fetchUserFriends,
  fetchFriendRequests
} from "../controllers/UserController";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = express.Router();
router.post("/add-friend-request", authenticate, addFriendRequest);

router.post("/add-friend", authenticate, addFriend);

router.post("/remove-friend-request", authenticate, removeFriendRequest);

router.get("/search", authenticate, searchUsers);

router.get("/friends/get", authenticate, fetchUserFriends);

router.get("/friend-requests/get", authenticate, fetchFriendRequests);

export default router;
