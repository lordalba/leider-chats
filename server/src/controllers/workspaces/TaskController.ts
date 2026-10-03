import { Request, Response } from "express";
import Task from "../../models/workspaces/Task";
import { MyUserRequest } from "../../types/express";

export const createTask = async (req: MyUserRequest, res: Response) => {
  try {
    const { title, description, assignedTo, dueDate, workspaceId } = req.body;

    const task = await Task.create({
      title,
      description,
      assignedTo,
      createdBy: req.userId,
      dueDate,
      workspace: workspaceId,
    });

    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: "Error creating task", error });
  }
};

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json(task);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving task", error });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const { title, description, assignedTo, completed, dueDate } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, assignedTo, completed, dueDate },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json(task);
  } catch (error) {
    return res.status(500).json({ message: "Error updating task", error });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json({ message: "Task deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting task", error });
  }
};
