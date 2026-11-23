import path from "path";

/** Largest chat attachment (keep in sync with client/src/chat/attachments.js). */
export const MAX_ATTACHMENT_MB = 25;

/**
 * File types that can be sent in a chat (keep in sync with client/src/chat/attachments.js).
 * Anything else is rejected with a clear message. SVG is left out on purpose: it can contain scripts.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
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

export const extensionOf = (fileName: string): string => path.extname(fileName).slice(1).toLowerCase();

export const isAllowedAttachment = (fileName: string): boolean =>
  ALLOWED_ATTACHMENT_EXTENSIONS.has(extensionOf(fileName));
