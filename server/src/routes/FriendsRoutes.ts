import express from "express";
import {
  addFriendRequest,
  addFriend,
  removeFriendRequest,
  removeFriend,
  searchUsers,
  fetchUserFriends,
  fetchFriendRequests
} from "../controllers/FriendsController";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = express.Router();
router.post("/add-friend-request", authenticate, addFriendRequest);

router.post("/add-friend", authenticate, addFriend);

router.post("/remove-friend-request", authenticate, removeFriendRequest);

router.post("/remove-friend", authenticate, removeFriend);

router.get("/search", authenticate, searchUsers);

router.get("/friends/get", authenticate, fetchUserFriends);

router.get("/friend-requests/get", authenticate, fetchFriendRequests);

export default router;
