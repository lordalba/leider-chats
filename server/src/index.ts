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
import whiteboardRouter from "./routes/workspaces/WhiteboardRoutes";
import taskRouter from "./routes/workspaces/TaskRoutes";
import documentRouter from "./routes/workspaces/DocumentRoutes";
import mediaUploadRoutes from "./utils/MediaUploader";
import socketHandlers from "./socketHandlers";
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
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/personal", personalRoutes);
app.use("/api/chatrooms", chatRoomsRoutes);
app.use("/api/workspaces", workspaceRouter);
app.use("/api/whiteboards", whiteboardRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/documents", documentRouter);
app.use("/api/uploads", mediaUploadRoutes);

connectDB();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

socketHandlers(io);
