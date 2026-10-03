import express from "express";
import { authenticate } from "../../middlewares/AuthMiddleware";
import {
  createWhiteboard,
  getWhiteboardById,
  updateWhiteboard,
  deleteWhiteboard,
} from "../../controllers/workspaces/WhiteboardController";

const router = express.Router();

router.post("/", authenticate, createWhiteboard);
router.get("/:id", authenticate, getWhiteboardById);
router.put("/:id", authenticate, updateWhiteboard);
router.delete("/:id", authenticate, deleteWhiteboard);

export default router;
