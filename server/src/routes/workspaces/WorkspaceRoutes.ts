import express from "express";
import { authenticate } from "../../middlewares/AuthMiddleware";
import { getAllWorkspaces, getWorkspaceById } from "../../controllers/workspaces/WorkspaceController";

const router = express.Router();

router.get("/", authenticate, getAllWorkspaces);
router.get("/:id", authenticate, getWorkspaceById);

export default router;
