import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { JWT_SECRET } from "../config/jwt";
import { asyncHandler } from "../http/asyncHandler";
import { HttpError } from "../http/HttpError";
import { uploadUrl } from "../utils/files";

const PASSWORD_MIN_LENGTH = 6;
const SESSION_LENGTH = "7d";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeEmail = (email: unknown) => (typeof email === "string" ? email.trim().toLowerCase() : "");
/** Matches an email regardless of case (older accounts may have been saved with capitals). */
const emailQuery = (email: string) => ({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });

const defaultProfilePicture = () =>
  process.env.PROFILE_PICTURE_DEFAULT_PATH || uploadUrl("profilePictures/default-avatar.svg");

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, password, age, profession, location } = req.body;
  const email = normalizeEmail(req.body.email);

  if (typeof username !== "string" || !username.trim()) throw HttpError.badRequest("Please choose a username.");
  if (!EMAIL_PATTERN.test(email)) throw HttpError.badRequest("Please enter a valid email address.");
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    throw HttpError.badRequest(`The password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  const parsedAge = Number(age);
  if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) throw HttpError.badRequest("Please enter a valid age.");

  if (await User.exists(emailQuery(email))) throw HttpError.badRequest("User already exists.");

  await User.create({
    username: username.trim(),
    email,
    password: await bcrypt.hash(password, 10),
    age: parsedAge,
    profession: typeof profession === "string" && profession.trim() ? profession.trim() : "—",
    location: typeof location === "string" && location.trim() ? location.trim() : "—",
    profilePictureUrl: defaultProfilePicture(),
    backgroundPictureUrl: process.env.BACKGROUND_PICTURE_DEFAULT_PATH,
  });

  res.status(201).json({ message: "User registered successfully." });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  // The client recognises this exact message to show a helpful hint.
  const invalid = () => HttpError.badRequest("Invalid credentials.");

  if (!email || typeof password !== "string") throw invalid();
  const user = await User.findOne(emailQuery(email));
  if (!user || !(await bcrypt.compare(password, user.password))) throw invalid();

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: SESSION_LENGTH });
  res.status(200).json({ token });
});
