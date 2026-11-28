// Load .env here too: with CommonJS every import runs before index.ts's own
// body, so this module must not depend on dotenv having been called already.
import "dotenv/config";

export const DEFAULT_DEV_JWT_SECRET = "your_jwt_secret_key";

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (secret) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set when NODE_ENV=production");
  }
  console.warn(
    "JWT_SECRET is not set; using the insecure development default. Set JWT_SECRET in .env."
  );
  return DEFAULT_DEV_JWT_SECRET;
}

// Resolved once at module load, so the warning is logged at most once.
export const JWT_SECRET = resolveJwtSecret();
