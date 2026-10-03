// controllers/whiteboardController.ts
import { Request, Response } from "express";
import Whiteboard from "../../models/workspaces/whiteboard";
import { MyUserRequest } from "../../types/express";

export const createWhiteboard = async (req: MyUserRequest, res: Response) => {
  try {
    const { title, canvasData, workspaceId } = req.body;

    const whiteboard = await Whiteboard.create({
      title,
      canvasData,
      createdBy: req.userId,
      workspace: workspaceId,
    });

    return res.status(201).json(whiteboard);
  } catch (error) {
    return res.status(500).json({ message: "Error creating whiteboard", error });
  }
};

export const getWhiteboardById = async (req: Request, res: Response) => {
  try {
    const whiteboard = await Whiteboard.findById(req.params.id);
    if (!whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }

    return res.json(whiteboard);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving whiteboard", error });
  }
};

export const updateWhiteboard = async (req: Request, res: Response) => {
  try {
    const { title, canvasData } = req.body;
    const whiteboard = await Whiteboard.findByIdAndUpdate(
      req.params.id,
      { title, canvasData },
      { new: true }
    );

    if (!whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }

    return res.json(whiteboard);
  } catch (error) {
    return res.status(500).json({ message: "Error updating whiteboard", error });
  }
};

export const deleteWhiteboard = async (req: Request, res: Response) => {
  try {
    const whiteboard = await Whiteboard.findByIdAndDelete(req.params.id);
    if (!whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }

    return res.json({ message: "Whiteboard deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting whiteboard", error });
  }
};
