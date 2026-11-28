import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcrypt"; // For password hashing
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt";
import {
  findUserByIdentifier,
  isEmailTaken,
  isUsernameTaken,
  validateRegistration,
} from "../services/CredentialsService";

const INVALID_CREDENTIALS = "Invalid username/email or password.";

export const registerUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const validation = validateRegistration(req.body || {});
  if ("error" in validation) {
    return res.status(400).json({ message: validation.error });
  }
  const { username, email, password, age, profession, location } = validation.data;

  try {
    if (await isEmailTaken(email)) {
      return res.status(400).json({ message: "That email is already registered." });
    }
    if (await isUsernameTaken(username)) {
      return res.status(400).json({ message: "That username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      age,
      profession,
      location,
      profilePictureUrl: process.env.PROFILE_PICTURE_DEFAULT_PATH,
      backgroundPictureUrl: process.env.BACKGROUND_PICTURE_DEFAULT_PATH,
    });
    await newUser.save();

    return res.status(201).json({ message: "User registered successfully." });
  } catch (error: any) {
    // Two concurrent sign-ups with the same email: the unique index catches it.
    if (error?.code === 11000) {
      return res.status(400).json({ message: "That email is already registered." });
    }
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const loginUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const body = req.body || {};
  // `email` is the field older clients send; it may hold a username or an email.
  const rawIdentifier = body.identifier ?? body.email;
  const identifier = typeof rawIdentifier === "string" ? rawIdentifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ message: "Please enter your username or email and your password." });
  }

  try {
    const lookup = await findUserByIdentifier(identifier);
    if (!lookup.user) {
      const message = lookup.ambiguous
        ? "More than one account uses this username. Please log in with your email."
        : INVALID_CREDENTIALS;
      return res.status(400).json({ message });
    }
    const user = lookup.user;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: INVALID_CREDENTIALS });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};
