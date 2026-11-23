import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { authenticate } from "../middlewares/AuthMiddleware";
import { ensureUploadDir, uniqueFileName, uploadUrl } from "../utils/files";
import { MAX_ATTACHMENT_MB, extensionOf, isAllowedAttachment } from "../config/attachments";

const router = Router();
const MEDIA_DIR = "chatrooms/media";

class UnsupportedFileTypeError extends Error {}

const upload = multer({
  storage: multer.diskStorage({
    // The folder is git-ignored, so it may not exist yet on a fresh checkout.
    destination: (_req, _file, cb) => cb(null, ensureUploadDir(MEDIA_DIR)),
    filename: (_req, file, cb) => cb(null, uniqueFileName(file.originalname)),
  }),
  limits: { fileSize: MAX_ATTACHMENT_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAttachment(file.originalname)) cb(null, true);
    else cb(new UnsupportedFileTypeError(file.originalname));
  },
}).single("media");

/** Runs the upload; wrong types and oversized files become a 400 with a clear message. */
const uploadMedia = (req: Request, res: Response, next: NextFunction) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof UnsupportedFileTypeError) {
      const type = extensionOf(err.message);
      return res.status(400).json({ message: `Couldn't add a file of type "${type ? "." + type : "unknown"}".` });
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: `The file is too large (max ${MAX_ATTACHMENT_MB} MB).` });
    }
    return next(err);
  });
};

router.post("/uploadMedia", authenticate, uploadMedia, (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded." });
    return;
  }
  res.status(201).json({
    fileUrl: uploadUrl(`${MEDIA_DIR}/${req.file.filename}`),
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

export default router;
