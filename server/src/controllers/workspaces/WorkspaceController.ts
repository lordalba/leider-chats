import { Request, Response } from "express";
import Workspace from "../../models/workspaces/Workspace";
import ChatRoom from "../../models/chatrooms/ChatRoom";
import { MyUserRequest } from "../../types/express";
import {
  WorkspaceError,
  assertChatMember,
  assertWorkspaceMember,
} from "../../services/workspaces/WorkspaceAccess";

const statusFor = (error: WorkspaceError) =>
  error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 400;

export const createWorkspace = async (req: MyUserRequest, res: Response) => {
  try {
    const { name, description, chatRoomId } = req.body;
    if (!chatRoomId) {
      return res.status(400).json({ message: "chatRoomId is required" });
    }
    await assertChatMember(String(chatRoomId), String(req.userId));

    const workspace = await Workspace.create({
      name,
      description,
      chatRoomId,
      createdBy: req.userId,
    });

    return res.status(201).json(workspace);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return res.status(statusFor(error)).json({ message: error.message });
    }
    return res.status(500).json({ message: "Error creating workspace", error });
  }
};

export const getAllWorkspaces = async (req: MyUserRequest, res: Response) => {
  try {
    const chats = await ChatRoom.find({ participants: req.userId }, "_id");
    const workspaces = await Workspace.find({
      chatRoomId: { $in: chats.map((c) => c._id) },
    });

    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving workspaces", error });
  }
};

export const getWorkspaceById = async (req: MyUserRequest, res: Response) => {
  try {
    const { workspace } = await assertWorkspaceMember(
      req.params.id,
      String(req.userId)
    );
    return res.json(workspace);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return res.status(statusFor(error)).json({ message: error.message });
    }
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
