import express from "express";
import { authenticate } from "../../middlewares/AuthMiddleware";
import {
  getWorkspaces,
  getWorkspaceById,
} from "../../controllers/workspaces/WorkspaceController";

// Reads only; workspace writes go over sockets (workspace:* events).
const router = express.Router();

router.get("/", authenticate, getWorkspaces);
router.get("/:id", authenticate, getWorkspaceById);

export default router;
