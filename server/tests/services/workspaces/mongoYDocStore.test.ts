import mongoose from "mongoose";
import * as Y from "yjs";
import Document from "../../../src/models/workspaces/Document";
import { mongoYDocStore } from "../../../src/services/workspaces/mongoYDocStore";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../../helpers/db";

describe("mongoYDocStore", () => {
  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  it("round-trips a Yjs state through Mongo", async () => {
    const doc = await Document.create({
      title: "d",
      createdBy: new mongoose.Types.ObjectId(),
      workspace: new mongoose.Types.ObjectId(),
    });
    const id = String(doc._id);
    expect(await mongoYDocStore.load(id)).toBeNull();

    const ydoc = new Y.Doc();
    ydoc.getText("quill").insert(0, "hello mongo");
    await mongoYDocStore.save(id, Y.encodeStateAsUpdate(ydoc));

    const loaded = await mongoYDocStore.load(id);
    expect(loaded).toBeInstanceOf(Uint8Array);
    const copy = new Y.Doc();
    Y.applyUpdate(copy, loaded!);
    expect(copy.getText("quill").toString()).toBe("hello mongo");

    // Not selected by default.
    const plain = await Document.findById(id).lean();
    expect(plain).not.toHaveProperty("ydocState");
  });
});
