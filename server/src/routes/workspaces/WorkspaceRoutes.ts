import express from "express";
import { authenticate } from "../../middlewares/AuthMiddleware";
import {
  createWorkspace,
  getAllWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
} from "../../controllers/workspaces/WorkspaceController";

const router = express.Router();

router.post("/", authenticate, createWorkspace);
router.get("/", authenticate, getAllWorkspaces);
router.get("/:id", authenticate, getWorkspaceById);
router.put("/:id", authenticate, updateWorkspace);
router.delete("/:id", authenticate, deleteWorkspace);

export default router;
