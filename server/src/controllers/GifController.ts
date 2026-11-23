import { Response } from "express";
import { MyUserRequest } from "../types/express";
import { asyncHandler } from "../http/asyncHandler";
import { HttpError } from "../http/HttpError";
import { gifLibraryService } from "../services/GifLibraryService";

/** HTTP layer for the shared GIF library. The rules live in GifLibraryService. */

export const listGifs = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  res.status(200).json(await gifLibraryService.list(req.query.search));
});

export const addGif = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  if (!req.file) throw HttpError.badRequest("Pick a GIF to upload.");
  res.status(201).json(await gifLibraryService.add(String(req.userId), req.file, req.body.title));
});

export const removeGif = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  await gifLibraryService.remove(String(req.userId), req.params.id);
  res.status(204).end();
});
