/*
 * Dev helper for UI checks. LOCAL DATABASES ONLY. Keeps demo01..demoN joined
 * to the demo workspace (so presence shows a crowd), and optionally gives the
 * workspace a long description. Ctrl+C to stop.
 *
 *   node scripts/crowd-demo.js [count=5] [--long-description]
 */
const fs = require("fs");
const path = require("path");
const { io } = require("socket.io-client");

const API_URL = process.env.API_URL || "http://localhost:3000";
const demo = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "client", "scripts", "ui-shots", "demo.json"), "utf8")
);
const count = Number(process.argv.find((a) => /^\d+$/.test(a)) || 5);
const longDescription = process.argv.includes("--long-description");

async function login(email) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: demo.password }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`login failed for ${email}`);
  return body.token;
}

function call(socket, event, ...args) {
  return new Promise((resolve, reject) =>
    socket.emit(event, ...args, (r) => (r && r.ok ? resolve(r.data) : reject(new Error(`${event}: ${r && r.error}`))))
  );
}

async function join(email) {
  const socket = io(API_URL, { auth: { token: await login(email) }, transports: ["websocket"] });
  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });
  await call(socket, "workspace:join", demo.workspaceId);
  return socket;
}

(async () => {
  const sockets = [];
  for (let i = 1; i <= count; i++) sockets.push(await join(`demo${String(i).padStart(2, "0")}@test.local`));
  if (longDescription) {
    await call(sockets[0], "workspace:rename", demo.workspaceId, {
      description:
        "Planning the August trip up the coast: who drives which leg, where we sleep each night, " +
        "what we cook, who brings the dog, the budget split, and the playlist for the long stretches.",
    });
  }
  console.log(`${count} demo users joined`);
  process.on("SIGINT", () => {
    sockets.forEach((s) => s.close());
    process.exit(0);
  });
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
