import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { registerUser, loginUser } from "../../src/controllers/AuthController";
import { updateProfile } from "../../src/controllers/PersonalController";
import User from "../../src/models/User";
import { JWT_SECRET } from "../../src/config/jwt";

type Captured = { status: number; body: any };

async function call(
  handler: (req: any, res: Response) => Promise<unknown>,
  body: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): Promise<Captured> {
  const captured: Captured = { status: 0, body: undefined };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  } as unknown as Response;
  await handler({ body, ...extra } as unknown as Request, res);
  return captured;
}

const valid = {
  username: "maya",
  email: "Maya@Example.com",
  password: "secret123",
  age: 25,
  profession: "",
  location: "",
};

async function seedUser(overrides: Record<string, unknown> = {}) {
  return User.create({
    username: "maya",
    email: "maya@example.com",
    password: await bcrypt.hash("secret123", 4),
    age: 25,
    profession: "dev",
    location: "TLV",
    ...overrides,
  });
}

beforeAll(async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  await connectTestDb();
});
afterEach(clearTestDb);
afterAll(async () => {
  await disconnectTestDb();
  jest.restoreAllMocks();
});

describe("registerUser", () => {
  it("registers with empty optional profession and location", async () => {
    const r = await call(registerUser, valid);
    expect(r.status).toBe(201);
    const saved = await User.findOne({ username: "maya" });
    expect(saved?.email).toBe("maya@example.com"); // normalized
  });

  it("rejects a username that differs only by case", async () => {
    await seedUser();
    const r = await call(registerUser, { ...valid, username: "MAYA", email: "other@example.com" });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/username/i);
  });

  it("rejects an email that differs only by case", async () => {
    await seedUser();
    const r = await call(registerUser, { ...valid, username: "other", email: "MAYA@example.com" });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/email/i);
  });

  it.each([
    [{ password: undefined }, /password/i],
    [{ password: "123" }, /password/i],
    [{ age: "abc" }, /age/i],
    [{ email: "not-an-email" }, /email/i],
    [{ username: "a@b" }, /username/i],
    [{ username: "  " }, /username/i],
  ])("rejects invalid input %p with 400", async (patch, msg) => {
    const r = await call(registerUser, { ...valid, ...patch });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(msg);
  });
});

describe("loginUser", () => {
  beforeEach(() => seedUser());

  const userIdOf = (token: string) => (jwt.verify(token, JWT_SECRET) as any).userId;

  it("logs in with the email, ignoring case and spaces", async () => {
    const r = await call(loginUser, { identifier: "  MAYA@example.com ", password: "secret123" });
    expect(r.status).toBe(200);
    expect(userIdOf(r.body.token)).toBeDefined();
  });

  it("logs in with the username, ignoring case", async () => {
    const r = await call(loginUser, { identifier: "Maya", password: "secret123" });
    expect(r.status).toBe(200);
    const user = await User.findOne({ username: "maya" });
    expect(userIdOf(r.body.token)).toBe(String(user!._id));
  });

  it("still accepts the old { email } body", async () => {
    const r = await call(loginUser, { email: "maya@example.com", password: "secret123" });
    expect(r.status).toBe(200);
  });

  it("finds legacy users whose stored email has capitals", async () => {
    await clearTestDb();
    await seedUser({ email: "Legacy@Example.com" });
    const r = await call(loginUser, { identifier: "legacy@example.com", password: "secret123" });
    expect(r.status).toBe(200);
  });

  it("rejects a wrong password", async () => {
    const r = await call(loginUser, { identifier: "maya", password: "nope" });
    expect(r.status).toBe(400);
  });

  it("returns 400 (not 500) when fields are missing", async () => {
    const r = await call(loginUser, { identifier: "maya" });
    expect(r.status).toBe(400);
  });

  it("asks for the email when a legacy username is shared", async () => {
    await seedUser({ email: "twin@example.com" });
    const r = await call(loginUser, { identifier: "maya", password: "secret123" });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/email/i);
  });
});

describe("updateProfile username", () => {
  it("rejects renaming to another user's username", async () => {
    await seedUser();
    const me = await seedUser({ username: "noa", email: "noa@example.com" });
    const r = await call(
      updateProfile,
      { username: "MAYA", aboutMe: "", skills: "[]" },
      { userId: String(me._id) }
    );
    expect(r.status).toBe(400);
    expect((await User.findById(me._id))?.username).toBe("noa");
  });

  it("allows saving with an unchanged username", async () => {
    const me = await seedUser();
    const r = await call(
      updateProfile,
      { username: "maya", aboutMe: "hi", skills: "[]" },
      { userId: String(me._id) }
    );
    expect(r.status).toBe(200);
  });
});
