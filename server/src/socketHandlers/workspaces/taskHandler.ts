import { Server, Socket } from "socket.io";
import {
  TaskInput,
  TaskPatch,
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from "../../services/workspaces/TaskService";
import ITask, { TaskStatus } from "../../types/workspaces/ITask";
import { withAck } from "./withAck";
import { wsRoom } from "./rooms";

const taskHandler = (io: Server, socket: Socket) => {
  const broadcast = (task: ITask, action: "created" | "updated") => {
    const workspaceId = String(task.workspace);
    io.to(wsRoom(workspaceId)).emit("workspace:item", {
      workspaceId,
      kind: "task",
      action,
      item: task,
    });
  };

  socket.on(
    "task:create",
    withAck(socket, async (userId, workspaceId: string, input: TaskInput) => {
      const task = await createTask(userId, workspaceId, input);
      broadcast(task, "created");
      return task;
    })
  );

  socket.on(
    "task:update",
    withAck(socket, async (userId, taskId: string, patch: TaskPatch) => {
      const task = await updateTask(userId, taskId, patch);
      broadcast(task, "updated");
      return task;
    })
  );

  socket.on(
    "task:move",
    withAck(socket, async (userId, taskId: string, status: TaskStatus, order: number) => {
      const task = await moveTask(userId, taskId, status, order);
      broadcast(task, "updated");
      return task;
    })
  );

  socket.on(
    "task:delete",
    withAck(socket, async (userId, taskId: string) => {
      const { task } = await deleteTask(userId, taskId);
      const workspaceId = String(task.workspace);
      io.to(wsRoom(workspaceId)).emit("workspace:item", {
        workspaceId,
        kind: "task",
        action: "deleted",
        item: { _id: task._id },
      });
      return null;
    })
  );
};

export default taskHandler;
