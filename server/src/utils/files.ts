import fs from "fs";
import path from "path";

/** server/uploads (this file lives in server/src/utils). */
export const UPLOADS_DIR = path.join(__dirname, "../../uploads");

export const publicBaseUrl = (): string =>
  `${process.env.SERVER_BASE_URL || "http://localhost:"}${process.env.PORT || 3000}`;

/** Public address of a file under server/uploads, e.g. uploadUrl("chatrooms/x.png"). */
export const uploadUrl = (relativePath: string): string =>
  `${publicBaseUrl()}/uploads/${relativePath.split(path.sep).join("/")}`;

export const DEFAULT_GROUP_IMAGE = () => uploadUrl("chatrooms/default-group.png");

/** Creates a folder under server/uploads if it is missing and returns its absolute path. */
export const ensureUploadDir = (relativeDir: string): string => {
  const dir = path.join(UPLOADS_DIR, relativeDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Moves a multer temp file into server/uploads/<relativeDir>/<fileName>. Never throws synchronously. */
export const moveUpload = async (tempPath: string, relativeDir: string, fileName: string): Promise<string> => {
  const target = path.join(ensureUploadDir(relativeDir), fileName);
  try {
    await fs.promises.rename(tempPath, target);
  } catch {
    // rename fails across drives or when the target is locked: copy instead.
    await fs.promises.copyFile(tempPath, target);
    await fs.promises.unlink(tempPath).catch(() => undefined);
  }
  return uploadUrl(path.join(relativeDir, fileName));
};

/** A safe, unique file name that keeps the original extension. */
export const uniqueFileName = (originalName: string): string => {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
};
