import Task from "../../models/workspaces/Task";
import ITask, { TaskStatus } from "../../types/workspaces/ITask";
import IChatRoom from "../../types/chatrooms/IChatRoom";
import {
  WorkspaceError,
  assertWorkspaceMember,
  isChatParticipant,
  requireText,
  toObjectId,
} from "./WorkspaceAccess";

export type TaskInput = {
  title: string;
  description?: string;
  assignedTo?: string[];
  dueDate?: string | null;
  status?: TaskStatus;
  order?: number;
};

export type TaskPatch = Partial<Pick<TaskInput, "title" | "description" | "assignedTo" | "dueDate">>;

const STATUSES = Object.values(TaskStatus) as string[];

const asObject = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WorkspaceError("invalid");
  }
  return input as Record<string, unknown>;
};

const parseStatus = (value: unknown): TaskStatus => {
  if (typeof value !== "string" || !STATUSES.includes(value)) throw new WorkspaceError("invalid");
  return value as TaskStatus;
};

const parseOrder = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new WorkspaceError("invalid");
  return value;
};

const parseDescription = (value: unknown): string =>
  value === null ? "" : requireText(value, 0, 5000);

const parseDueDate = (value: unknown): Date | null => {
  if (value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") throw new WorkspaceError("invalid");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new WorkspaceError("invalid");
  return date;
};

const parseAssignees = (value: unknown, chat: IChatRoom) => {
  if (!Array.isArray(value)) throw new WorkspaceError("invalid");
  const unique = Array.from(new Set(value.map((v) => (typeof v === "string" ? v : ""))));
  return unique.map((id) => {
    let objectId;
    try {
      objectId = toObjectId(id);
    } catch {
      throw new WorkspaceError("invalid");
    }
    if (!isChatParticipant(chat, id)) throw new WorkspaceError("invalid");
    return objectId;
  });
};

const loadTaskForMember = async (userId: string, taskId: unknown) => {
  const task = await Task.findById(toObjectId(taskId));
  if (!task) throw new WorkspaceError("not_found");
  const { chat } = await assertWorkspaceMember(String(task.workspace), userId);
  return { task, chat };
};

export const createTask = async (
  userId: string,
  workspaceId: string,
  input: TaskInput
): Promise<ITask> => {
  const { workspace, chat } = await assertWorkspaceMember(workspaceId, userId);
  const body = asObject(input);

  const title = requireText(body.title, 1, 200);
  const description = body.description === undefined ? "" : parseDescription(body.description);
  const status = body.status === undefined ? TaskStatus.TODO : parseStatus(body.status);
  const assignedTo = body.assignedTo === undefined ? [] : parseAssignees(body.assignedTo, chat);
  const dueDate = body.dueDate === undefined ? null : parseDueDate(body.dueDate);

  let order: number;
  if (body.order === undefined) {
    // Append to the bottom of the column.
    const last = await Task.findOne({ workspace: workspace._id, status })
      .sort({ order: -1 })
      .select("order");
    order = last ? last.order + 1000 : 0;
  } else {
    order = parseOrder(body.order);
  }

  return Task.create({
    title,
    description,
    status,
    order,
    assignedTo,
    dueDate,
    createdBy: toObjectId(userId),
    workspace: workspace._id,
  });
};

/** Applies title/description/assignedTo/dueDate. Any other key is ignored. */
export const updateTask = async (
  userId: string,
  taskId: string,
  patch: TaskPatch
): Promise<ITask> => {
  const { task, chat } = await loadTaskForMember(userId, taskId);
  const body = asObject(patch);

  if (body.title !== undefined) task.title = requireText(body.title, 1, 200);
  if (body.description !== undefined) task.description = parseDescription(body.description);
  if (body.assignedTo !== undefined) {
    task.set("assignedTo", parseAssignees(body.assignedTo, chat));
  }
  if (body.dueDate !== undefined) task.dueDate = parseDueDate(body.dueDate);

  await task.save();
  return task;
};

export const moveTask = async (
  userId: string,
  taskId: string,
  status: TaskStatus,
  order: number
): Promise<ITask> => {
  const { task } = await loadTaskForMember(userId, taskId);
  task.status = parseStatus(status);
  task.order = parseOrder(order);
  await task.save();
  return task;
};

export const deleteTask = async (userId: string, taskId: string): Promise<{ task: ITask }> => {
  const { task } = await loadTaskForMember(userId, taskId);
  await Task.deleteOne({ _id: task._id });
  return { task };
};
