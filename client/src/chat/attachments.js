/** Largest attachment the server accepts (keep in sync with server/src/config/attachments.ts). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** File types that can be sent in a chat (keep in sync with server/src/config/attachments.ts). */
export const ALLOWED_EXTENSIONS = new Set([
  // pictures
  "png", "jpg", "jpeg", "gif", "webp", "bmp",
  // text
  "txt", "md", "csv", "json", "log",
  // documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf",
  // archives
  "zip", "rar", "7z",
  // audio
  "mp3", "wav", "ogg", "m4a",
  // video
  "mp4", "mov", "webm",
]);

/** "png" for "photo.PNG"; "" when there is no extension. */
export function extensionOf(fileName) {
  const match = /\.([^./\\]+)$/.exec(String(fileName || ""));
  return match ? match[1].toLowerCase() : "";
}

/** Why a file can't be sent, or null if it's fine. */
export function attachmentProblem(file) {
  const extension = extensionOf(file && file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return `Couldn't add a file of type "${extension ? "." + extension : "unknown"}".`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `The file is too large (max ${formatFileSize(MAX_ATTACHMENT_BYTES)}).`;
  }
  return null;
}

/** Which chat message type to use for a file. Pictures and audio play inline; the rest are files. */
export function messageTypeFor(file) {
  const mime = (file && file.type) || "";
  if (mime.startsWith("image/") && mime !== "image/svg+xml") return "image";
  if (mime.startsWith("audio/")) return "voice";
  return "file";
}

/** "1.2 MB", "350 KB", … */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
