import * as Y from "yjs";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { makeUser, makeChat } from "../../helpers/fixtures";
import Workspace from "../../../src/models/workspaces/Workspace";
import DocumentModel from "../../../src/models/workspaces/Document";
import { mongoYDocStore } from "../../../src/services/workspaces/mongoYDocStore";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("mongoYDocStore", () => {
  test("mongoYDocStore round-trips a Yjs state through Mongo", async () => {
    const alice = await makeUser("alice");
    const chat = await makeChat([alice], [alice]);
    const ws = await Workspace.create({ name: "W", chatRoomId: chat._id, createdBy: alice._id });
    const doc = await DocumentModel.create({ title: "D", workspace: ws._id, createdBy: alice._id });
    const id = String(doc._id);

    expect(await mongoYDocStore.load(id)).toBeNull();

    const y = new Y.Doc();
    y.getText("quill").insert(0, "persisted");
    await mongoYDocStore.save(id, Y.encodeStateAsUpdate(y));

    // ydocState is select:false — plain reads don't carry it.
    const plain = await DocumentModel.findById(id).lean();
    expect((plain as any).ydocState).toBeUndefined();

    const loaded = await mongoYDocStore.load(id);
    expect(loaded).toBeInstanceOf(Uint8Array);
    const back = new Y.Doc();
    Y.applyUpdate(back, loaded!);
    expect(back.getText("quill").toString()).toBe("persisted");
  });

  test("load/save of a missing or non-ObjectId doc does not throw", async () => {
    expect(await mongoYDocStore.load("64b000000000000000000009")).toBeNull();
    expect(await mongoYDocStore.load("nope")).toBeNull();
    await expect(mongoYDocStore.save("64b000000000000000000009", new Uint8Array([0, 0]))).resolves.toBeUndefined();
  });
});
