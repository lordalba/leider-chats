import Message from "../../../src/models/chatrooms/Message";
import Workspace from "../../../src/models/workspaces/Workspace";
import Task from "../../../src/models/workspaces/Task";
import Document from "../../../src/models/workspaces/Document";
import Whiteboard from "../../../src/models/workspaces/whiteboard";
import { WorkspaceError } from "../../../src/services/workspaces/WorkspaceAccess";
import {
  createWorkspace,
  deleteWorkspace,
  deleteWorkspacesForChat,
  getWorkspaceDetail,
  listWorkspaces,
} from "../../../src/services/workspaces/WorkspaceService";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../../helpers/db";
import { makeChat, makeUser } from "../../helpers/fixtures";

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "resolved";
  } catch (err) {
    return err instanceof WorkspaceError ? err.code : `other:${String(err)}`;
  }
};

describe("WorkspaceService", () => {
  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const setup = async () => {
    const admin = await makeUser("alice");
    const member = await makeUser("bob");
    const outsider = await makeUser("carol");
    const chat = await makeChat([admin, member], [admin]);
    return { admin, member, outsider, chat };
  };

  it("createWorkspace by participant saves workspace and system message with exact copy", async () => {
    const { member, chat } = await setup();
    const { workspace, message } = await createWorkspace(String(member._id), String(chat._id), {
      name: "  Launch plan  ",
    });
    expect(workspace.name).toBe("Launch plan");
    expect(String(workspace.chatRoomId)).toBe(String(chat._id));
    expect(message.content).toBe('bob created the workspace "Launch plan"');
    expect(message.type).toBe("system");
    expect(await Message.countDocuments({ chatRoomId: chat._id })).toBe(1);
  });

  it("createWorkspace by non-participant → forbidden", async () => {
    const { outsider, chat } = await setup();
    expect(await code(createWorkspace(String(outsider._id), String(chat._id), { name: "x" }))).toBe("forbidden");
  });

  it('name "   " → invalid; 81 chars → invalid; 80 chars ok', async () => {
    const { member, chat } = await setup();
    const uid = String(member._id);
    const cid = String(chat._id);
    expect(await code(createWorkspace(uid, cid, { name: "   " }))).toBe("invalid");
    expect(await code(createWorkspace(uid, cid, { name: "a".repeat(81) }))).toBe("invalid");
    expect(await code(createWorkspace(uid, cid, { name: "a".repeat(80) }))).toBe("resolved");
    expect(await code(createWorkspace(uid, cid, { name: "ok", description: "d".repeat(501) }))).toBe("invalid");
  });

  it("deleteWorkspace: plain non-creator → forbidden; chat admin → removes it and its contents", async () => {
    const { admin, member, chat } = await setup();
    const third = await makeUser("dave");
    await chat.updateOne({ $push: { participants: third._id } });
    const { workspace } = await createWorkspace(String(member._id), String(chat._id), { name: "WS" });
    const ref = { workspace: workspace._id, createdBy: member._id };
    await Task.create({ ...ref, title: "t" });
    await Document.create({ ...ref, title: "d" });
    await Whiteboard.create({ ...ref, title: "w" });

    expect(await code(deleteWorkspace(String(third._id), String(workspace._id)))).toBe("forbidden");
    expect(await code(deleteWorkspace(String(admin._id), String(workspace._id)))).toBe("resolved");

    expect(await Workspace.countDocuments()).toBe(0);
    expect(await Task.countDocuments()).toBe(0);
    expect(await Document.countDocuments()).toBe(0);
    expect(await Whiteboard.countDocuments()).toBe(0);
  });

  it("creator can delete their own workspace", async () => {
    const { member, chat } = await setup();
    const { workspace } = await createWorkspace(String(member._id), String(chat._id), { name: "WS" });
    expect(await code(deleteWorkspace(String(member._id), String(workspace._id)))).toBe("resolved");
  });

  it("getWorkspaceDetail does not include ydocState or strokes", async () => {
    const { member, chat } = await setup();
    const { workspace } = await createWorkspace(String(member._id), String(chat._id), { name: "WS" });
    const ref = { workspace: workspace._id, createdBy: member._id };
    await Document.create({ ...ref, title: "d", ydocState: Buffer.from([1, 2, 3]) });
    await Whiteboard.create({
      ...ref,
      title: "w",
      strokes: [{ id: "s1", userId: "u", color: "#000000", width: 2, points: [0, 0, 1, 1], createdAt: new Date() }],
    });

    const detail = await getWorkspaceDetail(String(member._id), String(workspace._id));
    expect(detail.documents).toHaveLength(1);
    expect(detail.whiteboards).toHaveLength(1);
    expect(detail.documents[0]).not.toHaveProperty("ydocState");
    expect(detail.whiteboards[0]).not.toHaveProperty("strokes");
    expect(detail.chat.participants.map((p) => p.username).sort()).toEqual(["alice", "bob"]);
  });

  it("listWorkspaces returns only workspaces of chats the user is in", async () => {
    const { admin, member, outsider, chat } = await setup();
    const otherChat = await makeChat([outsider, admin], [outsider]);
    await createWorkspace(String(member._id), String(chat._id), { name: "Mine" });
    await createWorkspace(String(outsider._id), String(otherChat._id), { name: "Theirs" });

    const forMember = await listWorkspaces(String(member._id));
    expect(forMember.map((w) => w.name)).toEqual(["Mine"]);
    expect(forMember[0].chatName).toBe("Test chat");

    const forAdmin = await listWorkspaces(String(admin._id));
    expect(forAdmin.map((w) => w.name).sort()).toEqual(["Mine", "Theirs"]);

    const filtered = await listWorkspaces(String(admin._id), String(otherChat._id));
    expect(filtered.map((w) => w.name)).toEqual(["Theirs"]);
    expect(await code(listWorkspaces(String(member._id), String(otherChat._id)))).toBe("forbidden");
  });

  it("deleteWorkspacesForChat returns the deleted ids", async () => {
    const { member, chat } = await setup();
    const { workspace } = await createWorkspace(String(member._id), String(chat._id), { name: "WS" });
    expect(await deleteWorkspacesForChat(String(chat._id))).toEqual([String(workspace._id)]);
    expect(await Workspace.countDocuments()).toBe(0);
  });
});
