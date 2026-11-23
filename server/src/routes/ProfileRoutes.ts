import express from "express";
import { fetchUserDetails, updateProfile } from "../controllers/ProfileController";
import { authenticate } from "../middlewares/AuthMiddleware";
import { imageOnlyUpload } from "../utils/uploads";

const router = express.Router();

const profilePictureUpload = imageOnlyUpload("profilePicture", 5, "Only image files can be used as a profile picture.");

router.get("/get", authenticate, fetchUserDetails);
router.put("/update-profile", authenticate, profilePictureUpload, updateProfile);

export default router;
