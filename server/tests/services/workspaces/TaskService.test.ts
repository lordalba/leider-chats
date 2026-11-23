import Workspace from "../../../src/models/workspaces/Workspace";
import Task from "../../../src/models/workspaces/Task";
import { WorkspaceError } from "../../../src/services/workspaces/WorkspaceAccess";
import { createTask, deleteTask, moveTask, updateTask } from "../../../src/services/workspaces/TaskService";
import { TaskStatus } from "../../../src/types/workspaces/ITask";
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

describe("TaskService", () => {
  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const setup = async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const outsider = await makeUser("carol");
    const chat = await makeChat([a, b], [a]);
    const ws = await Workspace.create({ name: "WS", chatRoomId: chat._id, createdBy: a._id });
    return { uid: String(a._id), bid: String(b._id), oid: String(outsider._id), wsId: String(ws._id) };
  };

  it("create defaults status todo and appends to the column", async () => {
    const { uid, wsId } = await setup();
    const first = await createTask(uid, wsId, { title: " First " });
    const second = await createTask(uid, wsId, { title: "Second" });
    expect(first.status).toBe("todo");
    expect(first.title).toBe("First");
    expect(second.order).toBeGreaterThan(first.order);
  });

  it("assignedTo with a non-participant → invalid; participant ok", async () => {
    const { uid, bid, oid, wsId } = await setup();
    expect(await code(createTask(uid, wsId, { title: "t", assignedTo: [oid] }))).toBe("invalid");
    expect(await code(createTask(uid, wsId, { title: "t", assignedTo: ["junk"] }))).toBe("invalid");
    const task = await createTask(uid, wsId, { title: "t", assignedTo: [bid, bid] });
    expect(task.assignedTo.map(String)).toEqual([bid]);
  });

  it("update ignores {workspace: otherId, createdBy: x}", async () => {
    const { uid, bid, wsId } = await setup();
    const task = await createTask(uid, wsId, { title: "t" });
    const updated = await updateTask(bid, String(task._id), {
      title: "new",
      workspace: "0123456789abcdef01234567",
      createdBy: bid,
    } as any);
    expect(updated.title).toBe("new");
    expect(String(updated.workspace)).toBe(wsId);
    expect(String(updated.createdBy)).toBe(uid);
  });

  it('move to "archived" → invalid; to "done" with order 1.5 persists both', async () => {
    const { uid, wsId } = await setup();
    const task = await createTask(uid, wsId, { title: "t" });
    expect(await code(moveTask(uid, String(task._id), "archived" as TaskStatus, 1))).toBe("invalid");
    await moveTask(uid, String(task._id), TaskStatus.DONE, 1.5);
    const stored = await Task.findById(task._id);
    expect(stored!.status).toBe("done");
    expect(stored!.order).toBe(1.5);
  });

  it("order NaN → invalid and nothing changes", async () => {
    const { uid, wsId } = await setup();
    const task = await createTask(uid, wsId, { title: "t" });
    expect(await code(moveTask(uid, String(task._id), TaskStatus.DONE, NaN))).toBe("invalid");
    expect((await Task.findById(task._id))!.status).toBe("todo");
  });

  it('taskId "zzz" → not_found', async () => {
    const { uid } = await setup();
    expect(await code(updateTask(uid, "zzz", { title: "x" }))).toBe("not_found");
    expect(await code(deleteTask(uid, "zzz"))).toBe("not_found");
  });

  it("outsider → forbidden", async () => {
    const { uid, oid, wsId } = await setup();
    expect(await code(createTask(oid, wsId, { title: "t" }))).toBe("forbidden");
    const task = await createTask(uid, wsId, { title: "t" });
    expect(await code(updateTask(oid, String(task._id), { title: "x" }))).toBe("forbidden");
  });

  it("validation limits", async () => {
    const { uid, wsId } = await setup();
    expect(await code(createTask(uid, wsId, { title: "a".repeat(201) }))).toBe("invalid");
    expect(await code(createTask(uid, wsId, { title: "t", description: "d".repeat(5001) }))).toBe("invalid");
    expect(await code(createTask(uid, wsId, { title: "t", dueDate: "not a date" }))).toBe("invalid");
    expect(await code(createTask(uid, wsId, null as any))).toBe("invalid");
    const withDate = await createTask(uid, wsId, { title: "t", dueDate: "2026-12-01" });
    expect(withDate.dueDate).toBeInstanceOf(Date);
  });
});
