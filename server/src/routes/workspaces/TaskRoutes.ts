// routes/taskRoutes.ts
import express from "express";
import { authenticate } from "../../middlewares/AuthMiddleware";
import { createTask, getTaskById, updateTask, deleteTask } from "../../controllers/workspaces/TaskController";

const router = express.Router();

router.post("/", authenticate, createTask);
router.get("/:id", authenticate, getTaskById);
router.put("/:id", authenticate, updateTask);
router.delete("/:id", authenticate, deleteTask);

export default router;