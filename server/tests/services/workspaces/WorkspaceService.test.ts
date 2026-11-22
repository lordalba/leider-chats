import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { makeUser, makeChat } from "../../helpers/fixtures";
import Workspace from "../../../src/models/workspaces/Workspace";
import Message from "../../../src/models/chatrooms/Message";
import Task from "../../../src/models/workspaces/Task";
import DocumentModel from "../../../src/models/workspaces/Document";
import Whiteboard from "../../../src/models/workspaces/whiteboard";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceDetail,
  listWorkspaces,
  renameWorkspace,
  deleteWorkspacesForChat,
} from "../../../src/services/workspaces/WorkspaceService";
import { WorkspacePresenceService } from "../../../src/services/workspaces/WorkspacePresenceService";

beforeAll(connectTestDb);
beforeEach(() => WorkspacePresenceService.reset());
afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function setup() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const carol = await makeUser("carol");
  const chat = await makeChat([alice, bob, carol], [alice]);
  return { alice, bob, carol, chat };
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

describe("WorkspaceService", () => {
  test("createWorkspace by participant saves workspace and system message with exact copy", async () => {
    const { bob, chat } = await setup();
    const { workspace, message } = await createWorkspace(String(bob._id), String(chat._id), {
      name: "  Plans  ",
      description: "desc",
    });
    expect(workspace.name).toBe("Plans");
    expect(String(workspace.chatRoomId)).toBe(String(chat._id));
    expect(String(workspace.createdBy)).toBe(String(bob._id));
    expect(await Workspace.countDocuments()).toBe(1);

    expect(message.content).toBe('bob created the workspace "Plans"');
    expect(message.type).toBe("system");
    const saved = await Message.findById(message._id);
    expect(saved?.content).toBe('bob created the workspace "Plans"');
    expect(String(saved?.chatRoomId)).toBe(String(chat._id));
  });

  test("createWorkspace by non-participant → forbidden", async () => {
    const { chat } = await setup();
    const outsider = await makeUser("outsider");
    await expectCode(createWorkspace(String(outsider._id), String(chat._id), { name: "X" }), "forbidden");
    expect(await Workspace.countDocuments()).toBe(0);
  });

  test('name "   " → invalid; 81 chars → invalid', async () => {
    const { alice, chat } = await setup();
    await expectCode(createWorkspace(String(alice._id), String(chat._id), { name: "   " }), "invalid");
    await expectCode(createWorkspace(String(alice._id), String(chat._id), { name: "a".repeat(81) }), "invalid");
    await expectCode(
      createWorkspace(String(alice._id), String(chat._id), { name: "ok", description: "d".repeat(501) }),
      "invalid"
    );
    const { workspace } = await createWorkspace(String(alice._id), String(chat._id), { name: "a".repeat(80) });
    await expectCode(renameWorkspace(String(alice._id), String(workspace._id), { name: "  " }), "invalid");
    const renamed = await renameWorkspace(String(alice._id), String(workspace._id), { name: " New " });
    expect(renamed.name).toBe("New");
  });

  test("non-ObjectId ids → not_found", async () => {
    const { alice } = await setup();
    await expectCode(createWorkspace(String(alice._id), "nope", { name: "x" }), "not_found");
    await expectCode(getWorkspaceDetail(String(alice._id), "nope"), "not_found");
  });

  test("deleteWorkspace by plain member who is not creator → forbidden; by chat admin → removes workspace and its tasks/documents/whiteboards", async () => {
    const { alice, bob, carol, chat } = await setup();
    const { workspace } = await createWorkspace(String(bob._id), String(chat._id), { name: "W" });
    const wsId = workspace._id;
    await Task.create({ title: "t", createdBy: bob._id, workspace: wsId });
    await DocumentModel.create({ title: "d", createdBy: bob._id, workspace: wsId });
    await Whiteboard.create({ title: "w", canvasData: "{}", createdBy: bob._id, workspace: wsId });

    await expectCode(deleteWorkspace(String(carol._id), String(wsId)), "forbidden");
    expect(await Workspace.countDocuments()).toBe(1);

    await deleteWorkspace(String(alice._id), String(wsId));
    expect(await Workspace.countDocuments()).toBe(0);
    expect(await Task.countDocuments()).toBe(0);
    expect(await DocumentModel.countDocuments()).toBe(0);
    expect(await Whiteboard.countDocuments()).toBe(0);
  });

  test("deleteWorkspace by creator is allowed", async () => {
    const { bob, chat } = await setup();
    const { workspace } = await createWorkspace(String(bob._id), String(chat._id), { name: "W" });
    const deleted = await deleteWorkspace(String(bob._id), String(workspace._id));
    expect(String(deleted._id)).toBe(String(workspace._id));
    expect(await Workspace.countDocuments()).toBe(0);
  });

  test("getWorkspaceDetail does not include ydocState or strokes", async () => {
    const { alice, chat } = await setup();
    const { workspace } = await createWorkspace(String(alice._id), String(chat._id), { name: "W" });
    // Raw inserts so the heavy fields exist regardless of the current schema.
    await DocumentModel.collection.insertOne({
      title: "doc",
      createdBy: alice._id,
      workspace: workspace._id,
      ydocState: Buffer.from("heavy"),
      updatedAt: new Date(),
    } as any);
    await Whiteboard.collection.insertOne({
      title: "board",
      createdBy: alice._id,
      workspace: workspace._id,
      strokes: [{ id: "s1" }],
      updatedAt: new Date(),
    } as any);
    await Task.create({ title: "t1", createdBy: alice._id, workspace: workspace._id });

    const detail = await getWorkspaceDetail(String(alice._id), String(workspace._id));
    expect(detail.documents).toHaveLength(1);
    expect(detail.whiteboards).toHaveLength(1);
    expect(detail.tasks).toHaveLength(1);
    const doc = JSON.parse(JSON.stringify(detail.documents[0]));
    const wb = JSON.parse(JSON.stringify(detail.whiteboards[0]));
    expect(doc.ydocState).toBeUndefined();
    expect(wb.strokes).toBeUndefined();
    expect(doc.title).toBe("doc");
    expect(wb.title).toBe("board");
    expect(detail.chat.participants).toHaveLength(3);
    expect(detail.chat.participants[0]).toHaveProperty("username");
  });

  test("listWorkspaces returns only workspaces of chats the user is in", async () => {
    const { alice, bob, chat } = await setup();
    const outsider = await makeUser("outsider");
    const otherChat = await makeChat([outsider, bob]);
    await createWorkspace(String(alice._id), String(chat._id), { name: "Mine" });
    await createWorkspace(String(outsider._id), String(otherChat._id), { name: "Theirs" });

    const aliceList = await listWorkspaces(String(alice._id));
    expect(aliceList.map((w) => w.name)).toEqual(["Mine"]);
    expect(aliceList[0].chatName).toBe("Test chat");

    const bobList = await listWorkspaces(String(bob._id));
    expect(bobList.map((w) => w.name).sort()).toEqual(["Mine", "Theirs"]);

    const filtered = await listWorkspaces(String(bob._id), String(otherChat._id));
    expect(filtered.map((w) => w.name)).toEqual(["Theirs"]);

    await expectCode(listWorkspaces(String(alice._id), String(otherChat._id)), "forbidden");
  });

  test("listWorkspaces chatName for unnamed 1:1 chat is the other participant's username", async () => {
    const { alice, bob } = await setup();
    const { default: ChatRoom } = await import("../../../src/models/chatrooms/ChatRoom");
    const dm = await ChatRoom.create({ isGroupChat: false, participants: [alice._id, bob._id], admins: [] });
    await createWorkspace(String(alice._id), String(dm._id), { name: "DM ws" });
    const list = await listWorkspaces(String(alice._id), String(dm._id));
    expect(list[0].chatName).toBe("bob");
  });

  test("deleteWorkspacesForChat removes all workspaces of the chat and returns ids", async () => {
    const { alice, chat } = await setup();
    const { workspace: w1 } = await createWorkspace(String(alice._id), String(chat._id), { name: "1" });
    const { workspace: w2 } = await createWorkspace(String(alice._id), String(chat._id), { name: "2" });
    await Task.create({ title: "t", createdBy: alice._id, workspace: w1._id });
    const ids = await deleteWorkspacesForChat(String(chat._id));
    expect(ids.sort()).toEqual([String(w1._id), String(w2._id)].sort());
    expect(await Workspace.countDocuments()).toBe(0);
    expect(await Task.countDocuments()).toBe(0);
  });
});
