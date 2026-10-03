import { Router } from "express";
import multer from "multer";
import path from "path";

const uploadRouter = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/chatrooms/media"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

uploadRouter.post("/uploadMedia", upload.single("media"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileUrl = `${process.env.SERVER_BASE_URL}${process.env.PORT}/uploads/chatrooms/media/${req.file.filename}`;
  return res.status(201).json({ fileUrl });
});

export default uploadRouter;
