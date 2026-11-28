import User from "../models/User";
import IUser from "../types/IUser";

// Case-insensitive comparison without regexes (no escaping pitfalls) and
// without needing a matching index.
const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const normalizeEmail = (value: unknown): string => asText(value).toLowerCase();
export const normalizeUsername = (value: unknown): string => asText(value);

/** Returns an error message, or null when the username is acceptable. */
export function usernameError(username: string): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters long.`;
  }
  // Login treats anything containing "@" as an email, so usernames can't have one.
  if (username.includes("@")) return "Username can't contain \"@\".";
  return null;
}

export type RegistrationInput = {
  username: string;
  email: string;
  password: string;
  age: number;
  profession: string;
  location: string;
};

export function validateRegistration(
  body: Record<string, unknown>
): { error: string } | { data: RegistrationInput } {
  const username = normalizeUsername(body.username);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const age = Number(body.age);

  const nameProblem = usernameError(username);
  if (nameProblem) return { error: nameProblem };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < PASSWORD_MIN) {
    return { error: `Password must be at least ${PASSWORD_MIN} characters long.` };
  }
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    return { error: "Please enter a valid age." };
  }

  return {
    data: {
      username,
      email,
      password,
      age,
      profession: asText(body.profession),
      location: asText(body.location),
    },
  };
}

export async function isEmailTaken(email: string): Promise<boolean> {
  return !!(await User.exists({ email }).collation(CASE_INSENSITIVE));
}

export async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  const filter: Record<string, unknown> = { username };
  if (exceptUserId) filter._id = { $ne: exceptUserId };
  return !!(await User.exists(filter).collation(CASE_INSENSITIVE));
}

export type IdentifierLookup =
  | { user: IUser }
  | { user: null; ambiguous: boolean };

/**
 * Finds the account for a login identifier: an email if it contains "@",
 * otherwise a username. Both match case-insensitively. Accounts created before
 * usernames were unique may share a username; that's reported as ambiguous.
 */
export async function findUserByIdentifier(identifier: string): Promise<IdentifierLookup> {
  const filter = identifier.includes("@")
    ? { email: normalizeEmail(identifier) }
    : { username: normalizeUsername(identifier) };
  const matches = await User.find(filter).collation(CASE_INSENSITIVE).limit(2);
  if (matches.length === 1) return { user: matches[0] };
  return { user: null, ambiguous: matches.length > 1 };
}
