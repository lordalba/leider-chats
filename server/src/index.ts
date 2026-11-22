// Must stay the first import: CommonJS runs imports before this file's body,
// and modules such as config/jwt read process.env at load time.
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { socketAuth } from "./socketHandlers/socketAuth";
import connectDB from "./config/db";
import authRoutes from "./routes/Auth";
import userRoutes from "./routes/UserRoutes";
import personalRoutes from "./routes/PersonalRoutes";
import chatRoomsRoutes from "./routes/chatrooms/ChatRoomsRoutes";
import workspaceRouter from "./routes/workspaces/WorkspaceRoutes";
import mediaUploadRoutes from "./utils/MediaUploader";
import socketHandlers from "./socketHandlers";
import path from "path";

const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
  maxHttpBufferSize: 5e6,
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
app.use("/api/uploads", mediaUploadRoutes);

connectDB();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

io.use(socketAuth);
socketHandlers(io);
