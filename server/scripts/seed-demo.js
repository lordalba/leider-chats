/*
 * Seeds a demo workspace for UI work and screenshots. LOCAL DATABASES ONLY.
 *
 *   MONGO_URI=mongodb://127.0.0.1:27017/leider-chats-dev node scripts/seed-demo.js
 *
 * Needs the server running (API_URL, default http://localhost:3000) against
 * the same database. Re-running replaces the previous demo chat and its
 * workspaces. Writes client/scripts/ui-shots/demo.json for shots.js.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { io } = require("socket.io-client");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/leider-chats-dev";
const API_URL = process.env.API_URL || "http://localhost:3000";
const PASSWORD = "Passw0rd!";
const CHAT_NAME = "Road trip crew";
const OUT = path.join(__dirname, "..", "..", "client", "scripts", "ui-shots", "demo.json");

const host = new URL(MONGO_URI.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error(`Refusing to seed a non-local database (${host}).`);
  process.exit(1);
}

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function api(route, body) {
  const res = await fetch(API_URL + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function ensureUser(username, email) {
  // "Already exists" is fine: login below proves the account works.
  await api("/api/auth/register", {
    username,
    email,
    password: PASSWORD,
    age: 30,
    profession: "Tester",
    location: "Tel Aviv",
  });
}

function connect(token) {
  const socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
  const call = (event, ...args) =>
    new Promise((resolve, reject) =>
      socket.emit(event, ...args, (r) =>
        r && r.ok ? resolve(r.data) : reject(new Error(`${event}: ${r && r.error}`))
      )
    );
  return new Promise((resolve, reject) => {
    socket.on("connect", () => resolve({ socket, call }));
    socket.on("connect_error", reject);
  });
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const people = [["alice", "alice@test.local"], ["bob", "bob@test.local"]];
  for (let i = 1; i <= 28; i++) {
    const n = String(i).padStart(2, "0");
    people.push([`demo${n}`, `demo${n}@test.local`]);
  }
  for (const [username, email] of people) await ensureUser(username, email);
  const users = await db
    .collection("users")
    .find({ email: { $in: people.map(([, email]) => email) } })
    .project({ username: 1, email: 1 })
    .toArray();
  if (users.length !== people.length) throw new Error(`expected ${people.length} users, found ${users.length}`);
  const byName = Object.fromEntries(users.map((u) => [u.username, u]));

  // Replace the previous demo chat and everything hanging off it.
  const old = await db.collection("chatrooms").find({ name: CHAT_NAME }).toArray();
  for (const chat of old) {
    const wsIds = (await db.collection("workspaces").find({ chatRoomId: chat._id }).toArray()).map((w) => w._id);
    for (const c of ["tasks", "documents", "whiteboards"]) {
      await db.collection(c).deleteMany({ workspace: { $in: wsIds } });
    }
    await db.collection("workspaces").deleteMany({ _id: { $in: wsIds } });
    await db.collection("messages").deleteMany({ chatRoomId: chat._id });
    await db.collection("chatrooms").deleteOne({ _id: chat._id });
  }

  const alice = byName.alice;
  const { insertedId: chatId } = await db.collection("chatrooms").insertOne({
    participants: people.map(([username]) => byName[username]._id),
    name: CHAT_NAME,
    isGroupChat: true,
    admins: [alice._id],
    adminPermissions: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const login = await api("/api/auth/login", { email: alice.email, password: PASSWORD });
  if (!login.body.token) throw new Error(`login failed: ${login.status}`);
  const { socket, call } = await connect(login.body.token);

  const ws = await call("workspace:create", String(chatId), {
    name: "Summer road trip",
    description: "Planning the August trip up the coast",
  });
  await call("workspace:create", String(chatId), {
    name: "Long-name workspace to check truncation everywhere it appears in the UI ok",
  });
  // Enough workspaces (> 5) for the sidebar's search box to appear.
  for (const [name, description] of [
    ["Budget", "Who owes what"],
    ["Camping gear", "Borrow, buy or rent"],
    ["Playlist", ""],
    ["Photos", "Shared album and best-of picks"],
  ]) {
    await call("workspace:create", String(chatId), { name, ...(description && { description }) });
  }
  const workspaceId = String(ws._id);
  await call("workspace:join", workspaceId);

  const me = String(alice._id);
  const bob = String(byName.bob._id);
  const tasks = [
    { title: "Book campsites", status: "todo", assignedTo: [me], dueDate: day(-2) },
    { title: "Rent the van", status: "todo", assignedTo: [me, bob], dueDate: day(0) },
    {
      title:
        "Figure out whether we can bring the dog, which campsites allow pets, what the rules are for leashes, " +
        "and whether anyone is allergic so we can plan seating in the van for the long drives",
      status: "todo",
    },
    {
      title: "Make a packing list",
      status: "inProgress",
      assignedTo: [bob],
      description: "Tents, stove, first aid kit, chargers.",
      dueDate: day(5),
    },
    { title: "Confirm the budget", status: "verify", dueDate: day(1) },
    { title: "Pick the route", status: "done", assignedTo: [me] },
  ];
  for (const task of tasks) await call("task:create", workspaceId, task);

  const doc = await call("doc:create", workspaceId, "Itinerary");
  await call(
    "doc:create",
    workspaceId,
    "A document whose title is long enough to test truncation in the list, the header, and on narrow phone screens!!"
  );
  const wb = await call("wb:create", workspaceId, "Route sketch");
  await call("wb:open", String(wb._id));
  await call("wb:stroke", String(wb._id), {
    id: "seed-1",
    color: "#e6194b",
    width: 4,
    points: [0.1, 0.2, 0.3, 0.4, 0.5, 0.3, 0.7, 0.6],
  });
  await call("wb:stroke", String(wb._id), {
    id: "seed-2",
    color: "#4363d8",
    width: 8,
    points: [0.2, 0.8, 0.4, 0.7, 0.6, 0.75, 0.85, 0.5],
  });
  socket.close();

  const demo = {
    workspaceId,
    chatId: String(chatId),
    docId: String(doc._id),
    whiteboardId: String(wb._id),
    email: alice.email,
    password: PASSWORD,
    bobEmail: byName.bob.email,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(demo, null, 2));
  console.log(`WORKSPACE=${workspaceId} CHAT=${chatId}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
