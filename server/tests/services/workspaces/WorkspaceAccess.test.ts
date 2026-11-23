import ChatRoom from "../../../src/models/chatrooms/ChatRoom";
import Workspace from "../../../src/models/workspaces/Workspace";
import {
  WorkspaceError,
  assertWorkspaceMember,
  isChatAdmin,
  toObjectId,
} from "../../../src/services/workspaces/WorkspaceAccess";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../../helpers/db";
import { makeChat, makeUser } from "../../helpers/fixtures";

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "resolved";
  } catch (err) {
    return err instanceof WorkspaceError ? err.code : `other:${(err as Error).name}`;
  }
};

describe("WorkspaceAccess", () => {
  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const setup = async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const outsider = await makeUser("carol");
    const chat = await makeChat([a, b], [a]);
    const ws = await Workspace.create({ name: "WS", chatRoomId: chat._id, createdBy: a._id });
    return { a, b, outsider, chat, ws };
  };

  it("assertWorkspaceMember resolves for a chat participant", async () => {
    const { b, chat, ws } = await setup();
    const result = await assertWorkspaceMember(String(ws._id), String(b._id));
    expect(String(result.workspace._id)).toBe(String(ws._id));
    expect(String(result.chat._id)).toBe(String(chat._id));
  });

  it("rejects a non-participant with forbidden", async () => {
    const { outsider, ws } = await setup();
    expect(await code(assertWorkspaceMember(String(ws._id), String(outsider._id)))).toBe("forbidden");
  });

  it("rejects a missing workspace with not_found", async () => {
    const { a } = await setup();
    expect(await code(assertWorkspaceMember("0123456789abcdef01234567", String(a._id)))).toBe("not_found");
  });

  it('rejects "abc" (invalid ObjectId) with not_found, not a CastError', async () => {
    const { a } = await setup();
    expect(await code(assertWorkspaceMember("abc", String(a._id)))).toBe("not_found");
    // isValidObjectId alone accepts any 12-character string.
    expect(() => toObjectId("aaaaaaaaaaaa")).toThrow(WorkspaceError);
  });

  it("access follows the chat", async () => {
    const { b, chat, ws } = await setup();
    await ChatRoom.updateOne({ _id: chat._id }, { $pull: { participants: b._id } });
    expect(await code(assertWorkspaceMember(String(ws._id), String(b._id)))).toBe("forbidden");
  });

  it("isChatAdmin true only for ids in chat.admins", async () => {
    const { a, b, chat } = await setup();
    expect(isChatAdmin(chat, String(a._id))).toBe(true);
    expect(isChatAdmin(chat, String(b._id))).toBe(false);
  });
});
