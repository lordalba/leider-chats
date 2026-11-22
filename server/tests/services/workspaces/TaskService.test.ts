import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { makeUser, makeChat } from "../../helpers/fixtures";
import Workspace from "../../../src/models/workspaces/Workspace";
import Task from "../../../src/models/workspaces/Task";
import {
  createTask,
  updateTask,
  moveTask,
  deleteTask,
} from "../../../src/services/workspaces/TaskService";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function setup() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const carol = await makeUser("carol");
  const chat = await makeChat([alice, bob], [alice]);
  const ws = await Workspace.create({ name: "W", chatRoomId: chat._id, createdBy: alice._id });
  return { alice, bob, carol, chat, ws, a: String(alice._id), wsId: String(ws._id) };
}

const code = (p: Promise<unknown>, c: string) => expect(p).rejects.toMatchObject({ code: c });

describe("TaskService", () => {
  test("create defaults status todo and appends to end of column", async () => {
    const { a, wsId } = await setup();
    const t1 = await createTask(a, wsId, { title: "  one " });
    expect(t1.status).toBe("todo");
    expect(t1.title).toBe("one");
    expect(t1.order).toBe(0);
    const t2 = await createTask(a, wsId, { title: "two" });
    expect(t2.order).toBe(1000);
    const t3 = await createTask(a, wsId, { title: "x", status: "done" as any });
    expect(t3.order).toBe(0);
  });

  test("assignedTo with a non-participant -> invalid; duplicates collapse", async () => {
    const { a, carol, bob, wsId } = await setup();
    await code(createTask(a, wsId, { title: "t", assignedTo: [String(carol._id)] }), "invalid");
    const t = await createTask(a, wsId, { title: "t", assignedTo: [String(bob._id), String(bob._id)] });
    expect(t.assignedTo).toHaveLength(1);
  });

  test("title, description and dueDate validation", async () => {
    const { a, wsId } = await setup();
    await code(createTask(a, wsId, { title: "   " }), "invalid");
    await code(createTask(a, wsId, { title: "x".repeat(201) }), "invalid");
    await code(createTask(a, wsId, { title: "ok", description: "x".repeat(5001) }), "invalid");
    await code(createTask(a, wsId, { title: "ok", dueDate: "nope" }), "invalid");
  });

  test("update ignores {workspace, createdBy}; dueDate null clears; empty patch invalid", async () => {
    const { a, bob, wsId } = await setup();
    const t = await createTask(a, wsId, { title: "t", dueDate: "2030-01-01T00:00:00.000Z" });
    const other = "507f1f77bcf86cd799439011";
    const u = await updateTask(a, String(t._id), {
      title: "new",
      workspace: other,
      createdBy: String(bob._id),
    } as any);
    expect(u.title).toBe("new");
    expect(String(u.workspace)).toBe(wsId);
    expect(String(u.createdBy)).toBe(a);
    const c = await updateTask(a, String(t._id), { dueDate: null });
    expect(c.dueDate).toBeFalsy();
    await code(updateTask(a, String(t._id), { workspace: other } as any), "invalid");
  });

  test("move to archived -> invalid; to done with 1.5 persists; NaN invalid", async () => {
    const { a, wsId } = await setup();
    const t = await createTask(a, wsId, { title: "t" });
    await code(moveTask(a, String(t._id), "archived" as any, 1), "invalid");
    await code(moveTask(a, String(t._id), "done" as any, NaN), "invalid");
    await moveTask(a, String(t._id), "done" as any, 1.5);
    const fresh = await Task.findById(t._id);
    expect(fresh!.status).toBe("done");
    expect(fresh!.order).toBe(1.5);
  });

  test("bad ids -> not_found; outsider -> forbidden", async () => {
    const { a, carol, wsId } = await setup();
    await code(updateTask(a, "zzz", { title: "x" }), "not_found");
    await code(deleteTask(a, "zzz"), "not_found");
    await code(createTask(a, "zzz", { title: "x" }), "not_found");
    const t = await createTask(a, wsId, { title: "t" });
    const c = String(carol._id);
    await code(createTask(c, wsId, { title: "x" }), "forbidden");
    await code(updateTask(c, String(t._id), { title: "x" }), "forbidden");
    await code(moveTask(c, String(t._id), "done" as any, 1), "forbidden");
    await code(deleteTask(c, String(t._id)), "forbidden");
    expect(await Task.findById(t._id)).not.toBeNull();
  });

  test("delete returns task and removes it", async () => {
    const { a, wsId } = await setup();
    const t = await createTask(a, wsId, { title: "t" });
    const { task } = await deleteTask(a, String(t._id));
    expect(String(task._id)).toBe(String(t._id));
    expect(await Task.findById(t._id)).toBeNull();
  });
});
