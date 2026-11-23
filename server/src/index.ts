import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db";
import authRoutes from "./routes/Auth";
import userRoutes from "./routes/UserRoutes";
import personalRoutes from "./routes/PersonalRoutes";
import chatRoomsRoutes from "./routes/chatrooms/ChatRoomsRoutes";
import workspaceRouter from "./routes/workspaces/WorkspaceRoutes";
import mediaUploadRoutes from "./utils/MediaUploader";
import socketHandlers from "./socketHandlers";
import { socketAuth } from "./socketHandlers/socketAuth";
import { yDocManager } from "./services/workspaces/mongoYDocStore";
import path from "path";

dotenv.config();

const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "http://localhost:8080",
    // origin: ["http://10.0.0.18:8080", "http://localhost:8080"],
    methods: ["GET", "POST"],
  },
  // Yjs document states and whiteboard strokes can be larger than the 1 MB default.
  maxHttpBufferSize: 5e6,
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/personal", personalRoutes);
app.use("/api/chatrooms", chatRoomsRoutes);
// Workspace reads are REST; documents, tasks and whiteboards are written over Socket.IO.
app.use("/api/workspaces", workspaceRouter);
app.use("/api/uploads", mediaUploadRoutes);

connectDB();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

io.use(socketAuth);
socketHandlers(io);

// Persist any open collaborative documents before shutting down.
const shutdown = (signal: string) => {
  console.log(`${signal} received, saving open documents...`);
  yDocManager
    .flushAll()
    .catch((err) => console.error("Failed to save documents on shutdown:", err))
    .finally(() => process.exit(0));
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
