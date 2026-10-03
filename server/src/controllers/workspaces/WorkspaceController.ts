import { Request, Response } from "express";
import Workspace from "../../models/workspaces/Workspace";
import { MyUserRequest } from "../../types/express";

export const createWorkspace = async (req: MyUserRequest, res: Response) => {
  try {
    const { name, description, participants } =
      req.body;

    const workspace = await Workspace.create({
      name,
      description,
      documents: [],
      whiteboards: [],
      tasks: [],
      participants: participants || [],
      createdBy: req.userId,
    });

    res.status(201).json(workspace);
  } catch (error) {
    res.status(500).json({ message: "Error creating workspace", error });
  }
};

export const getAllWorkspaces = async (req: MyUserRequest, res: Response) => {
  try {
    const workspaces = await Workspace.find({
      "participants.userId": req.userId,
    });

    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving workspaces", error });
  }
};

export const getWorkspaceById = async (req: MyUserRequest, res: Response) => {
  try {
    const workspace = await Workspace.findById(req.params.id).populate([
      "documents",
      "whiteboards",
      "tasks",
    ]);

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (
      !workspace.participants.some(
        (participant) => participant.userId.toString() === req.userId
      )
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json(workspace);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving workspace", error });
  }
};

export const updateWorkspace = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    const workspace = await Workspace.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    return res.json(workspace);
  } catch (error) {
    return res.status(500).json({ message: "Error updating workspace", error });
  }
};

export const deleteWorkspace = async (req: Request, res: Response) => {
  try {
    const workspace = await Workspace.findByIdAndDelete(req.params.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    return res.json({ message: "Workspace deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting workspace", error });
  }
};
