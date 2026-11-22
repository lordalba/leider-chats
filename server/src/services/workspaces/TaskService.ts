import mongoose from "mongoose";
import Task from "../../models/workspaces/Task";
import ITask, { TaskStatus } from "../../types/workspaces/ITask";
import {
  WorkspaceError,
  assertWorkspaceMember,
  toObjectId,
} from "./WorkspaceAccess";

export const TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 5000;
const ORDER_STEP = 1000;

export type TaskInput = {
  title: string;
  description?: string;
  assignedTo?: string[];
  dueDate?: string | null;
  status?: TaskStatus;
  order?: number;
};

export type TaskPatch = Partial<
  Pick<TaskInput, "title" | "description" | "assignedTo" | "dueDate">
>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function validateTitle(title: unknown): string {
  if (typeof title !== "string") throw new WorkspaceError("invalid");
  const t = title.trim();
  if (t.length < 1 || t.length > TITLE_MAX) throw new WorkspaceError("invalid");
  return t;
}

function validateDescription(d: unknown): string {
  if (typeof d !== "string") throw new WorkspaceError("invalid");
  const t = d.trim();
  if (t.length > TASK_DESCRIPTION_MAX) throw new WorkspaceError("invalid");
  return t;
}

function validateStatus(status: unknown): TaskStatus {
  if (!Object.values(TaskStatus).includes(status as TaskStatus)) {
    throw new WorkspaceError("invalid");
  }
  return status as TaskStatus;
}

function validateOrder(order: unknown): number {
  if (typeof order !== "number" || !Number.isFinite(order)) {
    throw new WorkspaceError("invalid");
  }
  return order;
}

function validateDueDate(v: unknown): Date | null {
  if (v === null) return null;
  if (typeof v !== "string") throw new WorkspaceError("invalid");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new WorkspaceError("invalid");
  return d;
}

function validateAssignees(
  value: unknown,
  participants: unknown[]
): mongoose.Types.ObjectId[] {
  if (!Array.isArray(value)) throw new WorkspaceError("invalid");
  const members = new Set(participants.map(String));
  const seen = new Set<string>();
  const result: mongoose.Types.ObjectId[] = [];
  for (const v of value) {
    if (typeof v !== "string" || !/^[0-9a-fA-F]{24}$/.test(v)) {
      throw new WorkspaceError("invalid");
    }
    const id = v.toLowerCase();
    if (!members.has(id)) throw new WorkspaceError("invalid");
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(new mongoose.Types.ObjectId(id));
  }
  return result;
}

async function loadTaskForMember(userId: string, taskId: string) {
  const task = await Task.findById(toObjectId(taskId));
  if (!task) throw new WorkspaceError("not_found");
  const { chat } = await assertWorkspaceMember(String(task.workspace), userId);
  return { task, chat };
}

export async function createTask(
  userId: string,
  workspaceId: string,
  input: TaskInput
): Promise<ITask> {
  const { workspace, chat } = await assertWorkspaceMember(workspaceId, userId);
  if (!isPlainObject(input)) throw new WorkspaceError("invalid");

  const title = validateTitle(input.title);
  const description =
    input.description === undefined ? undefined : validateDescription(input.description);
  const assignedTo =
    input.assignedTo === undefined
      ? undefined
      : validateAssignees(input.assignedTo, chat.participants);
  const dueDate =
    input.dueDate === undefined ? undefined : validateDueDate(input.dueDate);
  const status = input.status === undefined ? TaskStatus.TODO : validateStatus(input.status);

  let order: number;
  if (input.order !== undefined) {
    order = validateOrder(input.order);
  } else {
    const last = await Task.findOne({ workspace: workspace._id, status })
      .sort({ order: -1 })
      .select("order");
    order = last ? last.order + ORDER_STEP : 0;
  }

  return Task.create({
    title,
    ...(description !== undefined && { description }),
    ...(assignedTo !== undefined && { assignedTo }),
    ...(dueDate && { dueDate }),
    status,
    order,
    workspace: workspace._id,
    createdBy: toObjectId(userId),
  });
}

export async function updateTask(
  userId: string,
  taskId: string,
  patch: TaskPatch
): Promise<ITask> {
  const { task, chat } = await loadTaskForMember(userId, taskId);
  if (!isPlainObject(patch)) throw new WorkspaceError("invalid");

  const keys = ["title", "description", "assignedTo", "dueDate"] as const;
  if (!keys.some((k) => patch[k] !== undefined)) throw new WorkspaceError("invalid");

  if (patch.title !== undefined) task.title = validateTitle(patch.title);
  if (patch.description !== undefined) {
    task.description = validateDescription(patch.description);
  }
  if (patch.assignedTo !== undefined) {
    task.assignedTo = validateAssignees(patch.assignedTo, chat.participants);
  }
  if (patch.dueDate !== undefined) {
    const d = validateDueDate(patch.dueDate);
    if (d === null) task.set("dueDate", undefined);
    else task.dueDate = d;
  }
  await task.save();
  return task;
}

export async function moveTask(
  userId: string,
  taskId: string,
  status: TaskStatus,
  order: number
): Promise<ITask> {
  const { task } = await loadTaskForMember(userId, taskId);
  task.status = validateStatus(status);
  task.order = validateOrder(order);
  await task.save();
  return task;
}

export async function deleteTask(
  userId: string,
  taskId: string
): Promise<{ task: ITask }> {
  const { task } = await loadTaskForMember(userId, taskId);
  await Task.deleteOne({ _id: task._id });
  return { task };
}
