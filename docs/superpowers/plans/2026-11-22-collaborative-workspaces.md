# Collaborative Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat participants create workspaces from a chat and edit task boards, rich-text documents and whiteboards in them together in real time, with presence.

**Architecture:** A `Workspace` belongs to a `ChatRoom`, and membership is derived from `ChatRoom.participants` with nothing duplicated. Reads go over REST. Every write is a Socket.IO event with an ack; the server validates and persists it, then broadcasts it to a per-workspace room. Documents sync as Yjs updates relayed and persisted by a server-side `YDocManager`. Whiteboards sync as append-only strokes. Presence is an in-memory service keyed by socket.

**Tech Stack:** Server: Node 22, Express 4, Mongoose 8, Socket.IO 4.8, TypeScript (strict), Jest + ts-jest, mongodb-memory-server, socket.io-client (tests). Client: Vue 2.7 (Options API), Vuex 3, bootstrap-vue, socket.io-client 4.8, Quill 1.3.7, yjs, y-protocols, y-quill, quill-cursors, Vitest (pure-module tests only).

**Spec:** `docs/superpowers/specs/2026-11-22-collaborative-workspaces-design.md`

## Global Constraints

- Membership rule: a user may read or write a workspace if and only if their id is in `ChatRoom.participants` of `workspace.chatRoomId`. This is checked server-side on every write.
- Every client→server workspace event takes an ack callback as its last argument, and the ack payload is `{ ok: true, data } | { ok: false, error }`.
- Error codes (exact strings): `"unauthenticated" | "forbidden" | "not_found" | "invalid" | "board_full" | "server_error"`.
- Any id that is not a valid ObjectId maps to `not_found`, never `server_error`.
- Text limits (trimmed): workspace name 1–80 chars, description ≤ 500; document/whiteboard title 1–120; task title 1–200, task description ≤ 5000.
- Yjs persistence debounce: `2000` ms. Client ack timeout: `10000` ms. Socket.IO `maxHttpBufferSize: 5e6`.
- Whiteboard: points stored normalized to `[0,1]` as a flat `[x0,y0,x1,y1,…]` array with even length, 2–4000 numbers. Colour matches `/^#[0-9a-f]{6}$/i`. Width is 1–40. Max `5000` strokes per board.
- Chat system message copy (exact): `${username} created the workspace "${name}"`.
- Server code uses the existing TS strictness (`noImplicitAny`, `strictNullChecks`, `noImplicitReturns`). Client code uses Vue 2 Options API, matching existing components.
- Client socket URL stays `http://localhost:3000`, and the API base stays `http://localhost:3000/api`, matching existing services.

## Review Focus

1. **A user is removed from, or leaves, the chat while the workspace is open:** they get `workspace:revoked` right away, and their next write is rejected with `forbidden`. Pinned in Task 4.
2. **Two sockets open the same not-yet-loaded document at the same moment:** exactly one Mongo load happens and no update is lost. Pinned in Task 8.
3. **A client drops off the network, keeps typing, then reconnects:** its offline edits merge into the server doc without being lost or duplicated. Pinned in Task 10.
4. **Garbage input** (non-ObjectId ids, missing fields, a malformed Yjs update, an oversized stroke) gets `not_found`/`invalid` and leaves stored state untouched. The server never crashes. Pinned in Tasks 1, 6, 9 and 12.
5. **The same user in two tabs:** the presence bar shows them once, and closing one tab keeps them present. Pinned in Task 3.

## Socket Event Contract (shared by all tasks)

Client→server events (each with ack):

| Event | Args | Ack `data` | Broadcast |
|---|---|---|---|
| `workspace:create` | `chatRoomId, {name, description?}` | `IWorkspace` | chat room: `newMessage` (system msg); online chat participants: `chat:workspaces-changed {chatRoomId}` |
| `workspace:rename` | `workspaceId, {name?, description?}` | `IWorkspace` | `ws:<id>`: `workspace:updated IWorkspace`; chat participants: `chat:workspaces-changed` |
| `workspace:delete` | `workspaceId` | `null` | `ws:<id>`: `workspace:revoked {workspaceId}`; chat participants: `chat:workspaces-changed` |
| `workspace:join` | `workspaceId` | `{members: PresenceMember[]}` | `ws:<id>`: `workspace:presence` |
| `workspace:leave` | `workspaceId` | `null` | `ws:<id>`: `workspace:presence` |
| `workspace:focus` | `workspaceId, Focus \| null` | `null` | `ws:<id>`: `workspace:presence` |
| `task:create` | `workspaceId, TaskInput` | `ITask` | `ws:<id>`: `workspace:item {workspaceId, kind:"task", action:"created", item}` |
| `task:update` | `taskId, TaskPatch` | `ITask` | `workspace:item … action:"updated"` |
| `task:move` | `taskId, status, order` | `ITask` | `workspace:item … action:"updated"` |
| `task:delete` | `taskId` | `null` | `workspace:item … action:"deleted", item:{_id}` |
| `doc:create` / `wb:create` | `workspaceId, title` | item meta `{_id,title,updatedAt}` | `workspace:item kind:"document"\|"whiteboard" action:"created"` |
| `doc:rename` / `wb:rename` | `id, title` | item meta | `… action:"updated"` |
| `doc:delete` / `wb:delete` | `id` | `null` | `… action:"deleted"` |
| `doc:open` | `docId` | `{update: Uint8Array}` (full state) | — (socket joins `doc:<id>`) |
| `doc:close` | `docId` | `null` | — |
| `doc:update` | `docId, update: Uint8Array` | `null` | `doc:<id>` except sender: `doc:update {docId, update}` |
| `doc:awareness` | `docId, update: Uint8Array` (no ack, volatile) | — | `doc:<id>` except sender: `doc:awareness {docId, update}` |
| `wb:open` | `whiteboardId` | `{strokes: IStroke[]}` | — (joins `wb:<id>`) |
| `wb:close` | `whiteboardId` | `null` | — |
| `wb:drawing` | `whiteboardId, {strokeId, color, width, points}` (no ack, volatile) | — | `wb:<id>` except sender: `wb:drawing {whiteboardId, userId, …}` |
| `wb:stroke` | `whiteboardId, StrokeInput` | `IStroke` | `wb:<id>` except sender: `wb:stroke {whiteboardId, stroke}` |
| `wb:undo` | `whiteboardId, strokeId` | `null` | `wb:<id>`: `wb:stroke-removed {whiteboardId, strokeId}` |
| `wb:clear` | `whiteboardId` | `null` | `wb:<id>`: `wb:cleared {whiteboardId}` |

Server→client only: `workspace:revoked {workspaceId}`, which is sent to a removed user's sockets and to everyone on delete.

`doc:update` and `wb:stroke`/`wb:undo` authorize by "this socket is in the `doc:<id>`/`wb:<id>` room". Membership was checked at `open`, and eviction (Task 4) removes sockets from those rooms.

---

## Phase 0 — Environment

### Task 0: Install dependencies and test infrastructure

**Files:**
- Modify: `server/package.json`, `server/jest.config.js`, `client/package.json`
- Create: `server/tests/helpers/db.ts`, `server/tests/helpers/fixtures.ts`, `client/vitest.config.mjs`

**Interfaces:**
- Produces:
  - `connectTestDb(): Promise<void>` uses `process.env.MONGO_TEST_URI` if it's set, otherwise starts `MongoMemoryServer`. `clearTestDb(): Promise<void>`. `disconnectTestDb(): Promise<void>`.
  - `makeUser(username: string): Promise<IUser>` fills every required User field with placeholders. `makeChat(participants: IUser[], admins?: IUser[]): Promise<IChatRoom>` creates a group chat.

- [ ] **Step 1: Unblock npm.** At the moment `npm` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, which means a proxy or antivirus is intercepting TLS. The human partner fixes this, typically with `npm config set cafile <corp-ca.pem>`. Verify with `npm ping`, expecting `PONG`.
- [ ] **Step 2: Install.** Run `npm install` in `server/` and in `client/`. Then:
  - Server dev deps: `mongodb-memory-server@^10`, `socket.io-client@^4.8.0`.
  - Server deps: `yjs@^13.6`.
  - Client deps: `yjs@^13.6`, `y-protocols@^1.0.6`, `quill-cursors@^3.1`, plus the `y-quill` release whose `peerDependencies.quill` accepts `1.3.7`. Check with `npm view y-quill@0.1.5 peerDependencies`; the 1.x line needs Quill 2, so don't use it.
  - Client dev dep: `vitest@^2`, with the script `"test": "vitest run"`.
- [ ] **Step 3: Configure test helpers.** Add `testTimeout: 30000` to `server/jest.config.js`, and set `testPathIgnorePatterns` to `["/node_modules/", "/src/"]` so the stray `src/jest.config.js` tree isn't scanned. Write `client/vitest.config.mjs` with `test.include: ["tests/**/*.test.js"]` and `environment: "node"`. Write the helpers.
- [ ] **Step 4: Record the baseline.** Run `cd server && npx jest`. Expected: `OnlineUserService.test.ts` passes. `ChatRoomService.test.ts` already fails before this work because its import paths are wrong. Note it here and leave it alone.
- [ ] **Step 5: Commit** with `chore: add workspace test infrastructure and realtime deps`.

---

## Phase 1 — Foundation (chat-linked workspaces + presence)

### Task 1: Workspace model and access rules

**Files:**
- Modify: `server/src/models/workspaces/Workspace.ts`, `server/src/types/workspaces/IWorkspace.ts`
- Create: `server/src/services/workspaces/WorkspaceAccess.ts`
- Test: `server/tests/services/workspaces/WorkspaceAccess.test.ts`

**Interfaces:**
- Produces:
  - `IWorkspace` has the fields `{ name, description, chatRoomId: ObjectId (indexed, required), createdBy, createdAt, updatedAt }`. Remove `participants`, `documents`, `whiteboards`, `tasks`: children point at the workspace, and membership comes from the chat. Delete `WorkspaceRole` and `IWorkspaceParticipant`.
  - `class WorkspaceError extends Error { code: "forbidden" | "not_found" | "invalid" | "board_full" }`
  - `assertChatMember(chatRoomId: string, userId: string): Promise<IChatRoom>`
  - `assertWorkspaceMember(workspaceId: string, userId: string): Promise<{ workspace: IWorkspace; chat: IChatRoom }>`
  - `isChatAdmin(chat: IChatRoom, userId: string): boolean`
  - `toObjectId(id: unknown): mongoose.Types.ObjectId` throws `WorkspaceError("not_found")` when the value isn't a valid ObjectId string.

- [ ] **Step 1: Write the failing tests.** Use real Mongo via the Task 0 helpers.
  - `assertWorkspaceMember resolves for a chat participant` returns the workspace and the chat.
  - `rejects a non-participant with forbidden`
  - `rejects a missing workspace with not_found`
  - `rejects "abc" (invalid ObjectId) with not_found, not a CastError`
  - `access follows the chat`: after `$pull` of the user from `chat.participants`, the call rejects with `forbidden`.
  - `isChatAdmin true only for ids in chat.admins`
- [ ] **Step 2: Run** `npx jest tests/services/workspaces/WorkspaceAccess.test.ts`. Expected: FAIL, because the module is not found.
- [ ] **Step 3: Implement.** Change the model and write `WorkspaceAccess.ts`. Use `mongoose.isValidObjectId` together with a 24-hex check, because `isValidObjectId` also accepts any 12-character string.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(workspaces): link workspaces to chats with access rules`.

### Task 2: Socket authentication and ack wrapper

**Files:**
- Create: `server/src/config/jwt.ts`, `server/src/socketHandlers/socketAuth.ts`, `server/src/socketHandlers/workspaces/withAck.ts`, `server/src/socketHandlers/workspaces/rooms.ts`, `server/tests/helpers/socketHarness.ts`
- Modify: `server/src/middlewares/AuthMiddleware.ts` (import `JWT_SECRET` from `config/jwt.ts`), `server/src/index.ts` (`io.use(socketAuth)`, `maxHttpBufferSize: 5e6`), `client/src/store/models/socket.js` (`io(url, { auth: { token: localStorage.getItem("token") } })`)
- Test: `server/tests/socket/socketAuth.test.ts`

**Interfaces:**
- Produces:
  - `socketAuth(socket: Socket, next: (err?: Error) => void): void` sets `socket.data.userId` from a valid `handshake.auth.token`. It never rejects, so the existing chat flows keep working without a token.
  - `requireUserId(socket: Socket): string` throws `Error("unauthenticated")`.
  - `withAck<A extends unknown[], T>(socket: Socket, fn: (userId: string, ...args: A) => Promise<T>): (...args: [...A, AckFn?]) => void` takes the ack as the last argument when it's a function. It maps `WorkspaceError` to its `code`, `"unauthenticated"` to itself, and anything else to `"server_error"` (logged).
  - `wsRoom(id)`, `docRoom(id)`, `wbRoom(id)` return `"ws:"+id`, `"doc:"+id` and `"wb:"+id`.
  - `startTestServer(register: (io: Server, socket: Socket) => void): Promise<{ url: string; io: Server; close(): Promise<void> }>` and `connectAs(url: string, userId: string | null): Promise<ClientSocket>`, which signs a JWT with `JWT_SECRET`.

- [ ] **Step 1: Write the failing tests.**
  - `valid token sets socket.data.userId` (a test handler echoes it through `withAck`)
  - `no token → withAck handler acks {ok:false, error:"unauthenticated"}`
  - `WorkspaceError("forbidden") → {ok:false, error:"forbidden"}`
  - `thrown TypeError → {ok:false, error:"server_error"}`
  - `missing ack callback does not throw`
- [ ] **Step 2: Run** `npx jest tests/socket/socketAuth.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run the same command.** Expected: PASS. Then start the app with `npm run dev` and log in. Check by hand that the existing chat still sends and receives messages.
- [ ] **Step 5: Commit** with `feat(socket): authenticate sockets via JWT and add ack wrapper`.

### Task 3: Presence service

**Files:**
- Create: `server/src/services/workspaces/WorkspacePresenceService.ts`
- Test: `server/tests/services/workspaces/WorkspacePresenceService.test.ts`

**Interfaces:**
- Produces:
  - `type Focus = { kind: "document" | "task" | "whiteboard"; id: string }`
  - `interface PresenceMember { userId: string; username: string; profilePictureUrl?: string; focus: Focus | null }`
  - `WorkspacePresenceService.join(workspaceId, socketId, user: Omit<PresenceMember,"focus">): void`
  - `.leave(workspaceId, socketId): void`
  - `.setFocus(workspaceId, socketId, focus: Focus | null): void` is ignored if the socket hasn't joined.
  - `.members(workspaceId): PresenceMember[]` dedupes by `userId`. `focus` is the most recently set non-null focus across that user's sockets.
  - `.removeSocket(socketId): string[]` returns the workspaceIds the socket was in.
  - `.socketsOfUser(workspaceId, userId): string[]`
  - `.reset(): void`

- [ ] **Step 1: Write the failing tests.**
  - `same user in two sockets appears once`
  - `closing one of two sockets keeps the user present`
  - `removeSocket returns affected workspaces and drops the user when it was the last socket`
  - `focus reflects the latest non-null focus across the user's sockets`
  - `setFocus before join is a no-op`
  - `empty workspace returns []`
- [ ] **Step 2: Run** `npx jest tests/services/workspaces/WorkspacePresenceService.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** it as module-level `Map<workspaceId, Map<socketId, {user, focus, focusAt}>>`, mirroring how `OnlineUserService` is built.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(workspaces): in-memory presence service`.

### Task 4: Workspace service, socket handler, REST reads, chat cascade

**Files:**
- Create: `server/src/services/workspaces/WorkspaceService.ts`, `server/src/socketHandlers/workspaces/workspaceHandler.ts`, `server/src/socketHandlers/notifyChatParticipants.ts`
- Modify:
  - `server/src/controllers/workspaces/WorkspaceController.ts` and `server/src/routes/workspaces/WorkspaceRoutes.ts`: keep only `GET /` and `GET /:id`.
  - `server/src/socketHandlers/index.ts`: register the workspace handler.
  - `server/src/socketHandlers/chatRoomHandler.ts`: move `updateOnlineChatUsers` into `notifyChatParticipants.ts` and import it back. Call eviction in `removeParticipantFromChat` and `exitRoom`, and cascade in `deleteRoom`. Also cascade in `exitRoom` when `exitChatRoom` deleted the now-empty chat, which you can detect with `ChatRoom.exists`.
  - `server/src/socketHandlers/connectionHandler.ts`: on disconnect, call `removeSocket` and broadcast presence.
- Delete: the Document/Task/Whiteboard REST controllers and routes, and their mounts in `index.ts`. They allowed unauthenticated cross-workspace writes, and the socket events below replace them.
- Test: `server/tests/services/workspaces/WorkspaceService.test.ts`, `server/tests/socket/workspaceHandler.test.ts`

**Interfaces:**
- Consumes: Task 1 access functions, Task 2 `withAck`/rooms/harness, Task 3 presence.
- Produces:
  - `createWorkspace(userId, chatRoomId, input: {name: string; description?: string}): Promise<{ workspace: IWorkspace; message: IMessage }>` posts the system message in the exact copy from Global Constraints, with `type: "system"`.
  - `renameWorkspace(userId, workspaceId, patch): Promise<IWorkspace>`
  - `deleteWorkspace(userId, workspaceId): Promise<IWorkspace>` is allowed for the creator or a chat admin, otherwise it throws `forbidden`. It deletes the workspace's Tasks, Documents and Whiteboards.
  - `deleteWorkspacesForChat(chatRoomId): Promise<string[]>` returns the deleted ids.
  - `listWorkspaces(userId, chatRoomId?: string): Promise<(IWorkspace & { chatName: string })[]>` covers all of the user's chats, or the one chat given.
  - `getWorkspaceDetail(userId, workspaceId): Promise<{ workspace; chat: {_id, name, participants: {_id, username, profilePictureUrl}[]}; tasks: ITask[]; documents: ItemMeta[]; whiteboards: ItemMeta[] }>`, where `ItemMeta = {_id, title, updatedAt, createdBy}`. Never select `ydocState` or `strokes` here.
  - `evictUserFromChatWorkspaces(io: Server, chatRoomId: string, userId: string): Promise<void>` removes each of the user's sockets from every `ws:`/`doc:`/`wb:` room of the chat's workspaces, emits `workspace:revoked` to them, and rebroadcasts presence.
  - `notifyChatParticipants(io, chatroomId, emitName, emitData|null): Promise<void>` (the moved function)
  - REST: `GET /api/workspaces?chatRoomId=` → `listWorkspaces`. `GET /api/workspaces/:id` → `getWorkspaceDetail`. `WorkspaceError` maps to 403/404/400.

- [ ] **Step 1: Write the failing service tests.**
  - `createWorkspace by participant saves workspace and system message with exact copy`
  - `createWorkspace by non-participant → forbidden`
  - `name "   " → invalid; 81 chars → invalid`
  - `deleteWorkspace by plain member who is not creator → forbidden; by chat admin → removes workspace and its tasks/documents/whiteboards`
  - `getWorkspaceDetail does not include ydocState or strokes`
  - `listWorkspaces returns only workspaces of chats the user is in`
- [ ] **Step 2: Write the failing socket tests.** Use the harness with two users A and B in one chat, plus outsider C.
  - `A creates workspace → B (online) receives chat:workspaces-changed and newMessage in the chat room`
  - `A and B join → both receive presence with 2 members`
  - `C join → forbidden and C receives no presence events`
  - `A focus {kind:"task",id} → B's presence shows A's focus`
  - `A disconnects → B receives presence with 1 member`
  - **Review Focus 1:** `B removed from chat (emit removeParticipantFromChat) → B receives workspace:revoked, and B's next workspace:focus acks forbidden`
  - `deleteRoom → workspaces of that chat are deleted and joined sockets get workspace:revoked`
- [ ] **Step 3: Run** `npx jest tests/services/workspaces/WorkspaceService.test.ts tests/socket/workspaceHandler.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** the service, handler, controller, eviction and cascade. In the `workspace:join` handler, load `username`/`profilePictureUrl` from `User` once per join.
- [ ] **Step 5: Run the same command.** Expected: PASS. Run all of `npx jest`. Expected: no new failures beyond the Task 0 baseline.
- [ ] **Step 6: Commit** with `feat(workspaces): chat-scoped workspaces over sockets with presence and eviction`.

### Task 5: Client foundation (API, socket helper, workspace shell, chat entry point)

**Files:**
- Create:
  - `client/src/api/WorkspaceService.js`
  - `client/src/workspaces/socketCall.js`
  - `client/src/components/workspaces/PresenceBar.vue`
  - `client/src/components/workspaces/CreateWorkspaceModal.vue`
  - `client/src/components/chatroom/ChatWorkspaces.vue`
- Test: `client/tests/socketCall.test.js`
- Modify:
  - `client/src/router.js`: path `/workspaces/:workspaceId?`
  - `client/src/views/Workspaces.vue`: replace the hardcoded data
  - `client/src/components/workspaces/WorkspacesSidebar.vue`: group by `chatName` and remove the `participants.length` usage
  - `client/src/components/workspaces/WorkspaceMainContent.vue`
  - `client/src/components/chatroom/ChatroomSidebar.vue`: mount `<ChatWorkspaces :chatroom-id>` above the exit/delete options

**Interfaces:**
- Consumes: the REST routes and socket events from Task 4.
- Produces:
  - `fetchWorkspaces(chatRoomId?: string): Promise<AxiosResponse<Workspace[]>>` and `fetchWorkspace(id): Promise<AxiosResponse<WorkspaceDetail>>`, using the same bearer header pattern as `ChatRoomService.js`.
  - `emitWithAck(socket, event: string, ...args): Promise<any>` resolves `data`, rejects `Error(code)` on `ok:false`, and rejects `Error("timeout")` after 10000 ms.
  - `WorkspaceMainContent` props: `{ detail: WorkspaceDetail, members: PresenceMember[] }`. It emits `focus(Focus|null)`. Tabs `Tasks | Documents | Whiteboard` render placeholders until Tasks 7, 11 and 13 replace them.
  - `PresenceBar` props: `{ members: PresenceMember[] }`. It shows avatars (fall back to initials when there's no `profilePictureUrl`) with the username on hover.
  - `Workspaces.vue` owns the lifecycle. When `workspaceId` changes: `workspace:leave` the old one, `fetchWorkspace`, then `workspace:join` and keep `members` from the ack. It listens to `workspace:presence`, `workspace:updated` and `workspace:revoked` (toast `"You no longer have access to this workspace"` and route to `/workspaces`), and re-joins on the socket's `connect` event.

- [ ] **Step 1: Write the failing test** `client/tests/socketCall.test.js` with a fake socket whose `emit` calls the last argument.
  - `resolves data on ok:true`
  - `rejects with error code on ok:false`
  - `rejects "timeout" after 10000 ms` (uses `vi.useFakeTimers()`)
- [ ] **Step 2: Run** `cd client && npx vitest run tests/socketCall.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `socketCall.js`, then the API, components and view. `ChatWorkspaces` lists the chat's workspaces and offers "New workspace", which opens a b-modal with a name and description. On create it routes to `/workspaces/<id>`. It refetches on `chat:workspaces-changed` when the `chatRoomId` matches.
- [ ] **Step 4: Run the same command.** Expected: PASS. Then `npm run lint`. Expected: no errors.
- [ ] **Step 5: Manual check** (use the `run` skill). Use two browsers logged in as two members of one group chat:
  - Create a workspace from the chat sidebar: both see the system message and the list entry.
  - Both open it: each presence bar shows 2 avatars.
  - Remove the second user from the chat: they're redirected with the toast.
- [ ] **Step 6: Commit** with `feat(client): workspace shell with presence, created from chats`.

---

## Phase 2 — Task board

### Task 6: Task service and socket events

**Files:**
- Create: `server/src/services/workspaces/TaskService.ts`, `server/src/socketHandlers/workspaces/taskHandler.ts`
- Modify: `server/src/models/workspaces/Task.ts` and `server/src/types/workspaces/ITask.ts` (add `order: number`, required, default `0`; add index `{workspace: 1, status: 1, order: 1}`), `server/src/socketHandlers/index.ts`
- Test: `server/tests/services/workspaces/TaskService.test.ts`, `server/tests/socket/taskHandler.test.ts`

**Interfaces:**
- Consumes: `assertWorkspaceMember`, `withAck`, `wsRoom`.
- Produces:
  - `type TaskInput = { title: string; description?: string; assignedTo?: string[]; dueDate?: string | null; status?: TaskStatus; order?: number }`
  - `type TaskPatch = Partial<Pick<TaskInput, "title" | "description" | "assignedTo" | "dueDate">>`
  - `createTask(userId, workspaceId, input: TaskInput): Promise<ITask>`
  - `updateTask(userId, taskId, patch: TaskPatch): Promise<ITask>` ignores unknown keys.
  - `moveTask(userId, taskId, status: TaskStatus, order: number): Promise<ITask>`
  - `deleteTask(userId, taskId): Promise<{ task: ITask }>`, which the handler needs for `workspaceId`.
  - Validation, all `invalid`: the limits in Global Constraints, `assignedTo` ids must be chat participants, `status` must be in `TaskStatus`, `order` must be a finite number, `dueDate` must parse or be null.
  - Membership is checked through the task's `workspace`. An unknown or invalid `taskId` gives `not_found`.

- [ ] **Step 1: Write the failing service tests.**
  - `create defaults status todo`
  - `assignedTo with a non-participant → invalid`
  - `update ignores {workspace: otherId, createdBy: x}`
  - `move to "archived" → invalid; to "done" with order 1.5 persists both`
  - `order NaN → invalid`
  - `taskId "zzz" → not_found`
  - `outsider → forbidden`
- [ ] **Step 2: Write the failing socket test.** `A task:create → B (joined) receives workspace:item {kind:"task", action:"created"}`. Do the same for update, move and delete, plus `outsider task:delete → forbidden and task still exists`.
- [ ] **Step 3: Run** `npx jest tests/services/workspaces/TaskService.test.ts tests/socket/taskHandler.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** the service and the handler.
- [ ] **Step 5: Run the same command.** Expected: PASS.
- [ ] **Step 6: Commit** with `feat(tasks): realtime task board events`.

### Task 7: Task board UI

**Files:**
- Create: `client/src/workspaces/taskBoard.js`, `client/src/components/workspaces/tasks/TaskBoard.vue`, `client/src/components/workspaces/tasks/TaskCard.vue`, `client/src/components/workspaces/tasks/TaskEditModal.vue`
- Modify: `client/src/components/workspaces/WorkspaceMainContent.vue` (Tasks tab), `client/src/views/Workspaces.vue` (route `workspace:item` events into `detail`)
- Test: `client/tests/taskBoard.test.js`

**Interfaces:**
- Consumes: the Task 6 events and `emitWithAck`.
- Produces:
  - `STATUSES = ["todo","inProgress","verify","done"]` with labels `To do`, `In progress`, `Verify` and `Done`.
  - `groupTasks(tasks): Record<Status, Task[]>` sorts each column by `order` ascending, then `createdAt`.
  - `orderBetween(prev?: number, next?: number): number`: the midpoint when both are given, `prev + 1000` when only prev, `next - 1000` when only next, `0` when neither.
  - `applyItemEvent(items: Item[], event: {action, item}): Item[]` returns a new array. Created or updated upserts by `_id`, but an incoming item whose `updatedAt` is older than the stored one is ignored. Deleted removes the item.
  - `TaskBoard` props: `{ tasks, participants, members }`. It emits `focus`. Moving a card uses native HTML5 drag and drop: apply the move optimistically, call `task:move`, and on rejection revert and toast the error. A `TaskCard` shows a presence badge (avatar) for members whose `focus` is `{kind:"task", id: task._id}`. Opening `TaskEditModal` emits focus on that task, and closing it emits `null`.

- [ ] **Step 1: Write the failing tests.**
  - `groupTasks sorts by order within each status and returns all 4 keys even when empty`
  - `orderBetween(1,2)=1.5; (5,undefined)=1005; (undefined,5)=-995; ()=0`
  - `applyItemEvent ignores an update older than the stored updatedAt`
  - `applyItemEvent created for an existing _id does not duplicate`
  - `deleted removes the item`
- [ ] **Step 2: Run** `npx vitest run tests/taskBoard.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `taskBoard.js` and the components.
- [ ] **Step 4: Run the same command.** Expected: PASS. Then `npm run lint`. Expected: clean.
- [ ] **Step 5: Manual check** with two browsers:
  - Create, edit, assign, drag and delete cards: the other browser updates within about 1 s.
  - Open the same card's modal in both: each sees the other's avatar badge.
- [ ] **Step 6: Commit** with `feat(client): realtime kanban task board`.

---

## Phase 3 — Shared documents (Yjs)

### Task 8: YDocManager (load, apply, debounce-persist, evict)

**Files:**
- Create: `server/src/services/workspaces/YDocManager.ts`, `server/src/services/workspaces/mongoYDocStore.ts`
- Modify: `server/src/models/workspaces/Document.ts` and `server/src/types/workspaces/IDocument.ts` (replace `content` with `ydocState: Buffer`, `select: false`)
- Test: `server/tests/services/workspaces/YDocManager.test.ts` (in-memory fake store), `server/tests/services/workspaces/mongoYDocStore.test.ts`

**Interfaces:**
- Produces:
  - `interface YDocStore { load(docId: string): Promise<Uint8Array | null>; save(docId: string, state: Uint8Array): Promise<void> }`
  - `class YDocManager`:
    - `constructor(store: YDocStore, opts?: { saveDebounceMs?: number })`, default `2000`
    - `open(docId, socketId): Promise<Uint8Array>` returns the full state via `Y.encodeStateAsUpdate`.
    - `applyUpdate(docId, update: Uint8Array): void` throws `WorkspaceError("invalid")` on a malformed update and leaves the doc unchanged. It throws `not_found` if the doc isn't loaded.
    - `close(docId, socketId): Promise<void>` flushes and evicts when it was the last socket.
    - `closeSocket(socketId): Promise<void>`
    - `delete(docId): void` drops the doc without saving.
    - `flushAll(): Promise<void>`
    - `isLoaded(docId): boolean`
  - `mongoYDocStore: YDocStore` is backed by `Document.ydocState`.
  - `export const yDocManager = new YDocManager(mongoYDocStore)` is the singleton.

- [ ] **Step 1: Write the failing tests** (`jest.useFakeTimers()` where noted).
  - **Review Focus 2:** `two concurrent open() calls for an unloaded doc call store.load exactly once and both get the same state`
  - `applyUpdate then 2000 ms → store.save called once with state containing the text` (fake timers; several updates inside the window give one save)
  - `last close flushes immediately and evicts; reopen loads the saved state`
  - `malformed update (Uint8Array [1,2,3]) → invalid, and the subsequent state equals the prior state`
  - `delete() cancels a pending save`
  - `mongoYDocStore round-trips a Yjs state through Mongo`
- [ ] **Step 2: Run** `npx jest tests/services/workspaces/YDocManager.test.ts tests/services/workspaces/mongoYDocStore.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Keep a `Map<docId, { ydoc, sockets: Set, timer, loading?: Promise }>`. Concurrent opens await the same `loading` promise. Apply updates with `Y.applyUpdate(ydoc, update)`, called inside a try block, and validate first with `Y.decodeUpdate`.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(documents): server-side Yjs doc manager with debounced persistence`.

### Task 9: Document socket events

**Files:**
- Create: `server/src/services/workspaces/DocumentService.ts`, `server/src/socketHandlers/workspaces/documentHandler.ts`
- Modify: `server/src/socketHandlers/index.ts`, `server/src/socketHandlers/connectionHandler.ts` (call `yDocManager.closeSocket` on disconnect), `server/src/index.ts` (`yDocManager.flushAll()` on `SIGINT`/`SIGTERM` before exit), `WorkspaceService.deleteWorkspace` (call `yDocManager.delete` for each document)
- Test: `server/tests/socket/documentHandler.test.ts`

**Interfaces:**
- Consumes: Task 8 `yDocManager`, the Task 1 access functions, `withAck`, `docRoom`/`wsRoom`.
- Produces:
  - `createDocument(userId, workspaceId, title): Promise<ItemMeta>`
  - `renameDocument(userId, docId, title): Promise<ItemMeta & { workspaceId }>`
  - `deleteDocument(userId, docId): Promise<{ workspaceId }>`
  - `assertDocumentMember(userId, docId): Promise<{ workspaceId }>`
  - Handlers for `doc:create|rename|delete|open|close|update|awareness`, as in the contract. `doc:update` acks `forbidden` if the socket isn't in `docRoom(docId)`. Socket.IO delivers a `Buffer`, so wrap it with `new Uint8Array(buf)` before calling the manager.

- [ ] **Step 1: Write the failing tests** using real Yjs docs on the client side of the harness.
  - `A and B open; A sends an update inserting "hi" → B receives doc:update and, applied, B's Y.Text equals "hi"`
  - `concurrent inserts at position 0 from A and B converge to the same string on both`
  - `C (outsider) doc:open → forbidden; C doc:update without open → forbidden`
  - `malformed update → invalid, and B receives nothing`
  - `doc:delete → joined members receive workspace:item deleted; later doc:open → not_found`
  - `awareness from A is relayed to B but not echoed to A`
- [ ] **Step 2: Run** `npx jest tests/socket/documentHandler.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(documents): realtime document socket events`.

### Task 10: Client Yjs provider over the app socket

**Files:**
- Create: `client/src/workspaces/SocketYProvider.js`
- Test: `client/tests/SocketYProvider.test.js` (a fake hub mimics the server: it holds a `Y.Doc`, applies updates, and relays them to the other fake sockets)

**Interfaces:**
- Consumes: `emitWithAck`, and the `doc:open|close|update|awareness` events.
- Produces: `class SocketYProvider`:
  - `constructor(socket, docId: string, ydoc: Y.Doc)` exposes `.awareness` (a y-protocols `Awareness`).
  - `connect(): Promise<void>` calls `doc:open`, applies the server state with origin `this`, then sends `Y.encodeStateAsUpdate(ydoc, Y.encodeStateVector(serverDocFromState))`, which is the local edits the server lacks.
  - Local `ydoc.on("update")` events whose origin isn't `this` are emitted as `doc:update`. Updates made while disconnected are not emitted; they are covered by the diff on reconnect.
  - It re-runs `connect()` on the socket's `connect` event.
  - `destroy(): void` emits `doc:close`, removes all listeners, and calls `awareness.destroy()`.
  - `synced: boolean`, plus `on("synced", cb)`.

- [ ] **Step 1: Write the failing tests.**
  - `two providers on one hub converge after each inserts text`
  - **Review Focus 3:** `provider B disconnects, inserts "offline", reconnects → hub and A contain "offline" exactly once`
  - `updates received from the hub are not re-emitted (no echo loop: hub receives each update once)`
  - `destroy stops emitting and emits doc:close`
- [ ] **Step 2: Run** `npx vitest run tests/SocketYProvider.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(client): Yjs provider over Socket.IO`.

### Task 11: Document list and collaborative editor UI

**Files:**
- Create: `client/src/components/workspaces/ItemList.vue` (shared by documents and whiteboards), `client/src/components/workspaces/documents/DocumentEditor.vue`
- Modify: `client/src/components/workspaces/WorkspaceMainContent.vue` (Documents tab), `client/src/views/Workspaces.vue` (`workspace:item` for `document`)

**Interfaces:**
- Consumes: the `doc:create|rename|delete` events, `SocketYProvider`, `applyItemEvent` (Task 7), and `PresenceMember`.
- Produces:
  - `ItemList` props: `{ items: ItemMeta[], kind: "document"|"whiteboard", members, selectedId }`. It emits `select(id)`, `create(title)`, `rename(id,title)` and `delete(id)`. Delete asks for confirmation through the existing `ConfirmationModal.vue`. Each row shows avatars of members whose focus is `{kind, id}`.
  - `DocumentEditor` props: `{ docId, connectedUser }`. On mount it creates a `Y.Doc` and a `SocketYProvider`, a `Quill` (snow theme) with the `quill-cursors` module, and `new QuillBinding(ydoc.getText("quill"), quill, provider.awareness)`. It sets the awareness local state `{ user: { name: connectedUser.username, color } }`, where `color` is a stable hash of the user id into a fixed 8-colour palette. The editor stays read-only and shows "Connecting…" until `synced`. On destroy it tears down the binding, then the provider, then the doc. The parent emits focus `{kind:"document", id}` on open and `null` on close.

- [ ] **Step 1: Implement** the components. They have no unit tests: their logic lives in the already-tested `SocketYProvider` and `applyItemEvent`.
- [ ] **Step 2: Run** `npm run lint` and `npx vitest run`. Expected: clean, all pass.
- [ ] **Step 3: Manual check** with two browsers:
  - Both type in the same paragraph at once: the text converges, and each sees the other's named cursor.
  - Reload one browser: the content is still there.
  - Disable the network in one tab's DevTools, type, then re-enable: the edits appear in the other tab.
  - Rename and delete a document: the other list updates.
  - Paste a 3 MB image: it either syncs or is rejected without breaking the session. Record which happens.
- [ ] **Step 4: Commit** with `feat(client): collaborative documents with live cursors`.

---

## Phase 4 — Whiteboard

### Task 12: Stroke model, validation and whiteboard socket events

**Files:**
- Create: `server/src/services/workspaces/strokeValidation.ts`, `server/src/services/workspaces/WhiteboardService.ts`, `server/src/socketHandlers/workspaces/whiteboardHandler.ts`
- Modify: `server/src/models/workspaces/whiteboard.ts` and `server/src/types/workspaces/IWhiteboard.ts` (replace `canvasData` with `strokes: IStroke[]`, a subdocument with `_id: false` and `select: false`), `server/src/socketHandlers/index.ts`
- Test: `server/tests/services/workspaces/strokeValidation.test.ts`, `server/tests/socket/whiteboardHandler.test.ts`

**Interfaces:**
- Produces:
  - `interface IStroke { id: string; userId: string; color: string; width: number; points: number[]; createdAt: Date }`
  - `validateStroke(input: unknown, userId: string): IStroke` enforces the Global Constraints. `id` is 1–64 chars of `[A-Za-z0-9-]`. `userId` always comes from the socket, never from the input. Any violation throws `WorkspaceError("invalid")`.
  - `createWhiteboard`, `renameWhiteboard` and `deleteWhiteboard` have the same shapes as the Task 9 document service.
  - `addStroke(userId, whiteboardId, input): Promise<IStroke>` uses an atomic `updateOne({_id, "strokes.4999": {$exists: false}}, {$push})`. When nothing matched because the board is full, it throws `board_full`.
  - `undoStroke(userId, whiteboardId, strokeId): Promise<void>` uses `$pull` on `{id: strokeId, userId}`, so only your own strokes can be removed. If nothing matches it throws `not_found`.
  - `clearWhiteboard(userId, whiteboardId): Promise<void>` is allowed for the whiteboard's `createdBy` or a chat admin, otherwise `forbidden`.
  - `getStrokes(userId, whiteboardId): Promise<IStroke[]>`
  - Handlers implement `wb:*` from the contract. `wb:drawing` is relayed volatile only, without persisting, and only if the socket is in `wbRoom`.

- [ ] **Step 1: Write the failing tests.**
  - Validation: `odd-length points → invalid`, `x = 1.2 → invalid`, `4002 numbers → invalid`, `color "red" → invalid`, `width 0 → invalid`, `input.userId is ignored in favour of the socket user`
  - Socket: `A wb:stroke → B receives wb:stroke; reopen returns it`, `B wb:undo of A's stroke → not_found and the stroke remains`, `plain member wb:clear on a board they did not create → forbidden; creator → B receives wb:cleared`, `5001st stroke → board_full` (seed 5000 strokes directly in Mongo), `wb:drawing reaches B and is not persisted`
- [ ] **Step 2: Run** `npx jest tests/services/workspaces/strokeValidation.test.ts tests/socket/whiteboardHandler.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run the same command.** Expected: PASS. Then run all of `npx jest`. Expected: no new failures beyond the Task 0 baseline.
- [ ] **Step 5: Commit** with `feat(whiteboard): realtime strokes with undo and clear`.

### Task 13: Whiteboard canvas UI

**Files:**
- Create: `client/src/workspaces/strokes.js`, `client/src/components/workspaces/whiteboard/WhiteboardCanvas.vue`
- Modify: `client/src/components/workspaces/WorkspaceMainContent.vue` (Whiteboard tab, reusing `ItemList` with `kind="whiteboard"`), `client/src/views/Workspaces.vue`
- Test: `client/tests/strokes.test.js`

**Interfaces:**
- Consumes: the Task 12 events and `emitWithAck`.
- Produces:
  - `normalizePoint(x, y, width, height): [number, number]` clamps to `[0,1]`.
  - `simplifyPoints(points: number[], tolerance = 0.002): number[]` uses Ramer–Douglas–Peucker on the flat array. The result always keeps the first and last point and is capped at 4000 numbers; it re-runs with a doubled tolerance until it fits.
  - `drawStroke(ctx, stroke, width, height): void` uses round caps and joins. Width scales by `canvasWidth / 1000`.
  - `WhiteboardCanvas` props: `{ whiteboardId, connectedUser }`.
    - It uses pointer events, so mouse, touch and pen all work.
    - While you draw, it emits throttled `wb:drawing` every 50 ms. On pointer-up it emits `wb:stroke`, with `id` from `crypto.randomUUID()`.
    - Remote in-progress strokes render on an overlay canvas keyed by `strokeId` and are dropped once the final `wb:stroke` arrives.
    - A `ResizeObserver` redraws everything, so normalized coordinates keep drawings aligned across screen sizes.
    - The toolbar has 6 preset colours, 3 widths, "Undo my last stroke" and "Clear board" (shown only to the board creator or chat admins).

- [ ] **Step 1: Write the failing tests.**
  - `normalizePoint clamps (-5, 1200, 1000, 1000) to [0, 1]`
  - `simplifyPoints keeps endpoints and removes collinear midpoints`
  - `simplifyPoints output never exceeds 4000 numbers for a 20000-number input`
- [ ] **Step 2: Run** `npx vitest run tests/strokes.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `strokes.js` and the component.
- [ ] **Step 4: Run** `npx vitest run` and `npm run lint`. Expected: all pass, clean.
- [ ] **Step 5: Manual check** with two browsers of different window sizes:
  - Strokes appear live while you draw, and land in the same relative place.
  - Undo removes only your own stroke.
  - The clear button is hidden for non-creators.
  - Reload: the strokes persist.
  - A presence badge shows on the whiteboard row while someone has it open.
- [ ] **Step 6: Commit** with `feat(client): realtime collaborative whiteboard`.
