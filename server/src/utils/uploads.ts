import { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import os from "os";

/**
 * Middleware that accepts one image in `fieldName` (up to `maxMegabytes`) into a temp file.
 * Wrong types and oversized files get a 400 with a clear message instead of an error page.
 * The controller then moves the temp file into place (see utils/files.ts → moveUpload).
 */
export const imageOnlyUpload = (fieldName: string, maxMegabytes: number, wrongTypeMessage: string): RequestHandler => {
  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: maxMegabytes * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error(wrongTypeMessage));
    },
  }).single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) return next();
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? `The file is too large (max ${maxMegabytes} MB).`
          : err instanceof Error
          ? err.message
          : "Upload failed.";
      return res.status(400).json({ message });
    });
  };
};
