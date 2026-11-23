import dotenv from "dotenv";

// Load .env here so the secret is available no matter which module imports it first.
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
