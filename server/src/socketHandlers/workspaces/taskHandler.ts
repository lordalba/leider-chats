import { Server, Socket } from "socket.io";
import { withAck } from "./withAck";
import { wsRoom } from "./rooms";
import {
  TaskInput,
  TaskPatch,
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from "../../services/workspaces/TaskService";
import ITask, { TaskStatus } from "../../types/workspaces/ITask";

const emitItem = (
  io: Server,
  task: ITask,
  action: "created" | "updated" | "deleted",
  item: unknown
) => {
  const workspaceId = String(task.workspace);
  io.to(wsRoom(workspaceId)).emit("workspace:item", {
    workspaceId,
    kind: "task",
    action,
    item,
  });
};

const taskHandler = (io: Server, socket: Socket) => {
  socket.on(
    "task:create",
    withAck(socket, async (userId, workspaceId: string, input: TaskInput) => {
      const task = await createTask(userId, workspaceId, input);
      emitItem(io, task, "created", task);
      return task;
    })
  );

  socket.on(
    "task:update",
    withAck(socket, async (userId, taskId: string, patch: TaskPatch) => {
      const task = await updateTask(userId, taskId, patch);
      emitItem(io, task, "updated", task);
      return task;
    })
  );

  socket.on(
    "task:move",
    withAck(socket, async (userId, taskId: string, status: TaskStatus, order: number) => {
      const task = await moveTask(userId, taskId, status, order);
      emitItem(io, task, "updated", task);
      return task;
    })
  );

  socket.on(
    "task:delete",
    withAck(socket, async (userId, taskId: string) => {
      const { task } = await deleteTask(userId, taskId);
      emitItem(io, task, "deleted", { _id: String(task._id) });
      return null;
    })
  );
};

export default taskHandler;
