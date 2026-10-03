import { Request, Response } from "express";
import Document from "../../models/workspaces/Document";
import { MyUserRequest } from "../../types/express";

export const createDocument = async (req: MyUserRequest, res: Response) => {
  try {
    const { title, content, workspaceId } = req.body;

    const document = await Document.create({
      title,
      content,
      createdBy: req.userId,
      workspace: workspaceId,
    });

    return res.status(201).json(document);
  } catch (error) {
    return res.status(500).json({ message: "Error creating document", error });
  }
};

export const getDocumentById = async (req: Request, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.json(document);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving document", error });
  }
};

export const updateDocument = async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      { title, content },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.json(document);
  } catch (error) {
    return res.status(500).json({ message: "Error updating document", error });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    return res.json({ message: "Document deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting document", error });
  }
};
