import path from "path";
import fs from "fs";
import { Types } from "mongoose";
import Gif from "../models/Gif";
import IGif from "../types/IGif";
import { HttpError } from "../http/HttpError";
import { DEFAULT_GIFS } from "../config/defaultGifs";
import { UPLOADS_DIR, moveUpload, uniqueFileName, uploadUrl } from "../utils/files";

const GIF_DIR = "gifs";
const MAX_TITLE_LENGTH = 60;
const MAX_RESULTS = 200;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "Funny_cat-2.gif" → "Funny cat 2" */
const titleFromFileName = (fileName: string) =>
  path
    .parse(fileName)
    .name.replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH) || "GIF";

/**
 * The shared GIF library: the built-in defaults plus every GIF users upload.
 * Everyone can use every GIF; only the person who added a GIF can remove it.
 */
export class GifLibraryService {
  /** Adds the default GIFs that aren't in the database yet. */
  async ensureDefaults(): Promise<void> {
    await Promise.all(
      DEFAULT_GIFS.map((gif) =>
        Gif.updateOne(
          { url: gif.url },
          { $setOnInsert: { url: gif.url, title: gif.title, isDefault: true, addedBy: null } },
          { upsert: true }
        )
      )
    );
  }

  /** Newest first; optionally filtered by title. */
  async list(search?: unknown): Promise<IGif[]> {
    const term = typeof search === "string" ? search.trim() : "";
    const filter = term ? { title: new RegExp(escapeRegex(term), "i") } : {};
    return Gif.find(filter).sort({ isDefault: 1, createdAt: -1 }).limit(MAX_RESULTS);
  }

  /** Moves an uploaded file into the library. The title defaults to the file name. */
  async add(userId: string, file: Express.Multer.File, title?: unknown): Promise<IGif> {
    const url = await moveUpload(file.path, GIF_DIR, uniqueFileName(file.originalname));
    const cleanTitle =
      typeof title === "string" && title.trim() ? title.trim().slice(0, MAX_TITLE_LENGTH) : titleFromFileName(file.originalname);
    return Gif.create({ url, title: cleanTitle, addedBy: new Types.ObjectId(userId), isDefault: false });
  }

  /** Removes a GIF the user added (and its file). Defaults and other people's GIFs can't be removed. */
  async remove(userId: string, gifId: unknown): Promise<void> {
    if (typeof gifId !== "string" || !Types.ObjectId.isValid(gifId)) throw HttpError.notFound("GIF not found.");
    const gif = await Gif.findById(gifId);
    if (!gif) throw HttpError.notFound("GIF not found.");
    if (gif.isDefault || !gif.addedBy || String(gif.addedBy) !== String(userId)) {
      throw HttpError.forbidden("You can only remove GIFs you added.");
    }
    await gif.deleteOne();
    await this.deleteFile(gif.url);
  }

  /** Deletes the uploaded file behind a library URL (ignores external URLs and missing files). */
  private async deleteFile(url: string): Promise<void> {
    const prefix = uploadUrl(`${GIF_DIR}/`);
    if (!url.startsWith(prefix)) return;
    const fileName = path.basename(url.slice(prefix.length));
    await fs.promises.unlink(path.join(UPLOADS_DIR, GIF_DIR, fileName)).catch(() => undefined);
  }
}

export const gifLibraryService = new GifLibraryService();
