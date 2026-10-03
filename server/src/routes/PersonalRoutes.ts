import express from "express";
import { fetchUserDetails, updateProfile } from "../controllers/PersonalController";
import { authenticate } from "../middlewares/AuthMiddleware";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.put("/update-profile", authenticate, upload.single("profilePicture"), updateProfile);

router.get("/get", authenticate, fetchUserDetails);

export default router;