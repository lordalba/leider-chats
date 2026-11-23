import express from "express";
import { addGif, listGifs, removeGif } from "../controllers/GifController";
import { authenticate } from "../middlewares/AuthMiddleware";
import { imageOnlyUpload } from "../utils/uploads";

const router = express.Router();
const gifUpload = imageOnlyUpload("gif", 10, "Only GIFs and images can be added to the GIF library.");

router.get("/", authenticate, listGifs);
router.post("/", authenticate, gifUpload, addGif);
router.delete("/:id", authenticate, removeGif);

export default router;
