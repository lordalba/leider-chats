import express from "express";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/AuthRoutes";
import friendsRoutes from "./routes/FriendsRoutes";
import profileRoutes from "./routes/ProfileRoutes";
import chatRoomsRoutes from "./routes/chatrooms/ChatRoomsRoutes";
import workspaceRoutes from "./routes/workspaces/WorkspaceRoutes";
import mediaRoutes from "./routes/MediaRoutes";
import gifRoutes from "./routes/GifRoutes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

/** The Express app: REST API + uploaded files. (Real-time features live in socketHandlers/.) */
export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", friendsRoutes);
  app.use("/api/personal", profileRoutes);
  app.use("/api/chatrooms", chatRoomsRoutes);
  // Workspace reads are REST; documents, tasks and whiteboards are written over Socket.IO.
  app.use("/api/workspaces", workspaceRoutes);
  app.use("/api/uploads", mediaRoutes);
  app.use("/api/gifs", gifRoutes);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);
  return app;
};
