// routes/documentRoutes.ts
import express from "express";
import { authenticate } from "../../middlewares/AuthMiddleware";
import {
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
} from "../../controllers/workspaces/DocumentController";

const router = express.Router();

router.post("/", authenticate, createDocument);
router.get("/:id", authenticate, getDocumentById);
router.put("/:id", authenticate, updateDocument);
router.delete("/:id", authenticate, deleteDocument);

export default router;
