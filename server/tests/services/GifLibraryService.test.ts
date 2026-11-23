import fs from "fs";
import os from "os";
import path from "path";
import Gif from "../../src/models/Gif";
import { GifLibraryService } from "../../src/services/GifLibraryService";
import { DEFAULT_GIFS } from "../../src/config/defaultGifs";
import { HttpError } from "../../src/http/HttpError";
import { UPLOADS_DIR } from "../../src/utils/files";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db";
import { makeUser } from "../helpers/fixtures";

const service = new GifLibraryService();

/** A fake multer upload in the temp folder. */
const tempUpload = (originalname: string): Express.Multer.File => {
  const tempPath = path.join(os.tmpdir(), `gif-test-${Date.now()}-${Math.random()}`);
  fs.writeFileSync(tempPath, "GIF89a");
  return { path: tempPath, originalname } as Express.Multer.File;
};

const statusOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (error) {
    return error instanceof HttpError ? error.status : 500;
  }
};

describe("GifLibraryService", () => {
  const createdFiles: string[] = [];

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(async () => {
    createdFiles.forEach((file) => fs.rmSync(file, { force: true }));
    await disconnectTestDb();
  });

  it("adds the defaults once, however often it runs", async () => {
    await service.ensureDefaults();
    await service.ensureDefaults();
    expect(await Gif.countDocuments({ isDefault: true })).toBe(DEFAULT_GIFS.length);
  });

  it("a GIF one user adds is in everyone's library, titled from the file name", async () => {
    const alice = await makeUser("alice");
    const gif = await service.add(String(alice._id), tempUpload("Happy_cat-dance.gif"));
    createdFiles.push(path.join(UPLOADS_DIR, "gifs", path.basename(gif.url)));

    expect(gif.title).toBe("Happy cat dance");
    const everyone = await service.list();
    expect(everyone.map((g) => g.url)).toContain(gif.url);
    expect((await service.list("cat")).map((g) => g.url)).toEqual([gif.url]);
  });

  it("only the person who added a GIF can remove it; defaults can't be removed", async () => {
    await service.ensureDefaults();
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");
    const gif = await service.add(String(alice._id), tempUpload("mine.gif"));
    const file = path.join(UPLOADS_DIR, "gifs", path.basename(gif.url));
    createdFiles.push(file);

    expect(await statusOf(service.remove(String(bob._id), String(gif._id)))).toBe(403);
    const someDefault = await Gif.findOne({ isDefault: true });
    expect(await statusOf(service.remove(String(alice._id), String(someDefault!._id)))).toBe(403);
    expect(await statusOf(service.remove(String(alice._id), "nope"))).toBe(404);

    expect(await statusOf(service.remove(String(alice._id), String(gif._id)))).toBe(200);
    expect(await Gif.exists({ _id: gif._id })).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
  });
});
