import { DEFAULT_DEV_JWT_SECRET, resolveJwtSecret } from "../../src/config/jwt";

describe("resolveJwtSecret", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  test("uses JWT_SECRET when set, without warning", () => {
    expect(resolveJwtSecret({ JWT_SECRET: "s3cret", NODE_ENV: "production" })).toBe("s3cret");
    expect(warn).not.toHaveBeenCalled();
  });

  test("production + missing JWT_SECRET → throws", () => {
    expect(() => resolveJwtSecret({ NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
  });

  test("non-production + missing JWT_SECRET → dev default with a warning", () => {
    expect(resolveJwtSecret({ NODE_ENV: "test" })).toBe(DEFAULT_DEV_JWT_SECRET);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("config/jwt module load", () => {
  const saved = { JWT_SECRET: process.env.JWT_SECRET, NODE_ENV: process.env.NODE_ENV };
  let warn: jest.SpyInstance;

  function restore(key: "JWT_SECRET" | "NODE_ENV") {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    // Keep the real .env out of these loads so the env below is what counts.
    jest.doMock("dotenv/config", () => ({}));
  });

  afterEach(() => {
    jest.dontMock("dotenv/config");
    restore("JWT_SECRET");
    restore("NODE_ENV");
    warn.mockRestore();
  });

  test("throws at load time in production when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    jest.isolateModules(() => {
      expect(() => require("../../src/config/jwt")).toThrow(/JWT_SECRET/);
    });
  });

  test("falls back to the dev default (warning once) outside production", () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "development";
    jest.isolateModules(() => {
      expect(require("../../src/config/jwt").JWT_SECRET).toBe(DEFAULT_DEV_JWT_SECRET);
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("uses JWT_SECRET from the environment at load time", () => {
    process.env.JWT_SECRET = "from-env";
    jest.isolateModules(() => {
      expect(require("../../src/config/jwt").JWT_SECRET).toBe("from-env");
    });
  });
});
