import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { makeUser, makeChat } from "../../helpers/fixtures";
import Workspace from "../../../src/models/workspaces/Workspace";
import ChatRoom from "../../../src/models/chatrooms/ChatRoom";
import {
  assertWorkspaceMember,
  assertChatMember,
  isChatAdmin,
  toObjectId,
  WorkspaceError,
} from "../../../src/services/workspaces/WorkspaceAccess";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function setup() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const outsider = await makeUser("outsider");
  const chat = await makeChat([alice, bob], [alice]);
  const workspace = await Workspace.create({
    name: "WS",
    chatRoomId: chat._id,
    createdBy: alice._id,
  });
  return { alice, bob, outsider, chat, workspace };
}

describe("WorkspaceAccess", () => {
  it("assertWorkspaceMember resolves for a chat participant", async () => {
    const { bob, chat, workspace } = await setup();
    const res = await assertWorkspaceMember(String(workspace._id), String(bob._id));
    expect(String(res.workspace._id)).toBe(String(workspace._id));
    expect(String(res.chat._id)).toBe(String(chat._id));
  });

  it("rejects a non-participant with forbidden", async () => {
    const { outsider, workspace } = await setup();
    await expect(
      assertWorkspaceMember(String(workspace._id), String(outsider._id))
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects a missing workspace with not_found", async () => {
    const { alice } = await setup();
    const p = assertWorkspaceMember("64b64b64b64b64b64b64b64b", String(alice._id));
    await expect(p).rejects.toBeInstanceOf(WorkspaceError);
    await expect(p).rejects.toMatchObject({ code: "not_found" });
  });

  it('rejects "abc" (invalid ObjectId) with not_found, not a CastError', async () => {
    const { alice } = await setup();
    await expect(assertWorkspaceMember("abc", String(alice._id))).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(assertChatMember("abc", String(alice._id))).rejects.toMatchObject({
      code: "not_found",
    });
    expect(() => toObjectId("123456789012")).toThrow(WorkspaceError);
  });

  it("access follows the chat", async () => {
    const { bob, chat, workspace } = await setup();
    await ChatRoom.updateOne({ _id: chat._id }, { $pull: { participants: bob._id } });
    await expect(
      assertWorkspaceMember(String(workspace._id), String(bob._id))
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("isChatAdmin true only for ids in chat.admins", async () => {
    const { alice, bob, chat } = await setup();
    expect(isChatAdmin(chat, String(alice._id))).toBe(true);
    expect(isChatAdmin(chat, String(bob._id))).toBe(false);
  });
});
