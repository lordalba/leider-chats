import { Response } from "express";
import path from "path";
import User from "../models/User";
import { MyUserRequest } from "../types/express";
import { asyncHandler } from "../http/asyncHandler";
import { HttpError } from "../http/HttpError";
import { moveUpload } from "../utils/files";

const MAX_ABOUT_LENGTH = 1000;

const parseSkills = (raw: unknown, current: string[]): string[] => {
  if (typeof raw !== "string") return current;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw HttpError.badRequest("Invalid skills.");
  }
  if (!Array.isArray(value)) throw HttpError.badRequest("Invalid skills.");
  const skills = value.map((skill) => String(skill).trim()).filter(Boolean);
  return Array.from(new Set(skills)).slice(0, 50);
};

/** The logged-in user's own profile (never includes password hashes). */
export const fetchUserDetails = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  const user = await User.findById(req.userId)
    .select("-password")
    .populate("friends", "username profilePictureUrl profession location");
  if (!user) throw HttpError.notFound("User not found.");
  res.status(200).json(user);
});

export const updateProfile = asyncHandler<MyUserRequest>(async (req, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw HttpError.notFound("User not found.");
  const { username, aboutMe } = req.body;

  let profilePictureUrl = user.profilePictureUrl;
  if (req.file) {
    // One picture per user; the version query makes browsers fetch the new one.
    const extension = path.extname(req.file.originalname).toLowerCase() || ".png";
    const url = await moveUpload(req.file.path, "profilePictures", `${req.userId}${extension}`);
    profilePictureUrl = `${url}?v=${Date.now()}`;
  }

  const updated = await User.findByIdAndUpdate(
    req.userId,
    {
      username: typeof username === "string" && username.trim() ? username.trim() : user.username,
      aboutMe: typeof aboutMe === "string" && aboutMe !== "null" ? aboutMe.slice(0, MAX_ABOUT_LENGTH) : "",
      skills: parseSkills(req.body.skills, user.skills || []),
      profilePictureUrl,
    },
    { new: true }
  ).select("-password");

  res.status(200).json({ message: "Profile updated successfully.", user: updated });
});
