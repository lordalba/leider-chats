import "./config/env";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db";
import { createApp } from "./app";
import socketHandlers from "./socketHandlers";
import { socketAuth } from "./socketHandlers/socketAuth";
import { yDocManager } from "./services/workspaces/mongoYDocStore";

const CLIENT_ORIGIN = "http://localhost:8080";
const PORT = process.env.PORT || 3000;

const app = createApp();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  // Yjs document states and whiteboard strokes can be larger than the 1 MB default.
  maxHttpBufferSize: 5e6,
});
io.use(socketAuth);
socketHandlers(io);

connectDB();
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// A failing socket handler must not take the whole server down.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

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
