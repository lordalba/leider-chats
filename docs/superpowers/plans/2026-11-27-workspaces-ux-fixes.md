# Workspaces UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding in the workspaces UX/UI audit. Work goes phase by phase, and each phase ships on its own.

**Architecture:** Behavior that can be expressed as a pure function goes in a small module under `client/src/workspaces/` and is unit-tested with vitest. Components stay thin and consume those modules. Visual results are checked with a committed screenshot harness (headless Chromium driven over the DevTools protocol), against a seeded demo workspace. Styling comes from one token stylesheet.

**Tech Stack:** Vue 2.7 (Options API), vue-router 3 (hash mode), bootstrap-vue 2, Font Awesome 6, Quill 1.3 + Yjs, Socket.IO 4, vitest (node env), jest (server).

**Spec:** `docs/superpowers/specs/2026-11-27-workspaces-ux-audit.md`. Finding IDs (S1, W3, T1, …) refer to it.

## Global Constraints

- No new npm dependencies (the registry is blocked by TLS interception). Use only bootstrap-vue, Font Awesome, Quill, date-fns, and Node built-ins.
- Accent `#45815c`, accent-strong `#2f5e43`, accent-soft `#e6f0ea`, danger `#c94a44`. No `#007bff` or Bootstrap-blue primary in workspace UI.
- No hex literals in workspace components except the whiteboard palette (`WB_COLORS`) and `CURSOR_COLORS`. Everything else uses `var(--ws-*)`.
- The layout must work at 390px width: no horizontal page scroll, and every action is reachable.
- Every interactive element is a `<button>`, `<a>`, or an element with `role` + `tabindex="0"` + an Enter/Space handler. Icon-only buttons have an `aria-label`.
- Every destructive action is confirmed via `confirmDanger` (Task 3), and nothing else.
- Copy is sentence case. Errors say what happened and what to do. No jokes in system UI.
- Keep both suites green: `cd client && npx vitest run` and `cd server && npx jest`. The `OnlineUserService` failure and the `ChatRoomService` compile failure were already there and are left as they are. `npm run lint` must add no new errors (`try.vue` and `vue.config.js` already have some).
- Each task ends with `node scripts/ui-shots/shots.js` (Task 0). Look at the PNGs it lists before committing.

## Review Focus

1. **A deep link to a missing item** (deleted, mistyped, or from another workspace): land on that tab with a toast. The URL is *replaced*, not pushed, so Back doesn't loop. Pinned in Task 5.
2. **Very long names** (80-char workspace, 120-char document title, 200-char task title): truncate with an ellipsis and a full-text tooltip, with no layout break at 390px. Seeded in Task 0, checked in Tasks 9, 11, 15.
3. **The workspace is renamed or deleted by someone else while you're in it:** the header and sidebar update live. Delete goes through the existing revoked flow to `/workspaces` with a toast. Pinned in Task 8.
4. **Keyboard only:** Tab reaches the sidebar rows, tabs (arrow keys move between them), cards (Enter opens), and the status select in the task modal. Pinned in Tasks 5, 9, 10.
5. **A chat with many participants** (30 seeded): the assignee picker scrolls inside a max-height, and presence collapses to "+N". Pinned in Tasks 4 and 10.

---

## Phase 0 — Tooling

### Task 0: Demo seed and screenshot harness

**Files:**
- Create: `server/scripts/seed-demo.js`
- Create: `client/scripts/ui-shots/cdp.js`, `client/scripts/ui-shots/shots.js`
- Modify: `client/.gitignore` (add `ui-shots-out/`)

**Interfaces:**
- Produces: `node server/scripts/seed-demo.js` prints `WORKSPACE=<id> CHAT=<id>` and writes `client/scripts/ui-shots/demo.json` `{ workspaceId, chatId, docId, whiteboardId, email, password }`.
- Produces: `node client/scripts/ui-shots/shots.js [--only <prefix>]` writes PNGs to `client/ui-shots-out/` and prints each path. Env: `CHROME` (default: the Edge path `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`), `APP` (default `http://localhost:8080/#`).

- [ ] **Step 1: Write `seed-demo.js`.** It connects with `MONGO_URI` (default `mongodb://127.0.0.1:27017/leider-chats-dev`) and refuses to run if the URI is not on localhost/127.0.0.1. It upserts users `alice@test.local` / `bob@test.local` (password `Passw0rd!`) through `POST /api/auth/register` (ignoring "already exists"), and inserts 28 more users `demo01..demo28` directly. It creates the group chat "Road trip crew" (alice admin, all 30 participants). Then, as alice over Socket.IO, it creates:
  - workspace "Summer road trip" with a description
  - a second workspace whose name is 80 characters
  - tasks in all four statuses (`todo`, `inProgress`, `verify`, `done`), one with a 200-char title, one with a description, one overdue, one due today
  - documents "Itinerary" and a 120-char title
  - whiteboard "Route sketch" with two strokes
- [ ] **Step 2: Copy the CDP driver** (from the audit's scratchpad version) into `cdp.js`, exporting `launch({ chrome }) -> api` with `size, nav, eval, click(sel, text), type, key(name), shot(name), noPageScroll()`. `noPageScroll()` returns `document.scrollingElement.scrollHeight <= innerHeight`.
- [ ] **Step 3: Write `shots.js`.** It logs in as alice through the form (dismissing any `.swal2-confirm`) and captures, at 1440×900 then 390×844:
  - `01-list`, `02-tasks`, `03-task-modal`, `04-documents`, `05-document`, `06-whiteboard`, `07-chat-details`
  - at 390 only: `08-mobile-*` for the same screens

  It prints `PAGE SCROLL: yes/no` per shot and collects console errors.
- [ ] **Step 4: Run it.** First `node server/scripts/seed-demo.js`, then `node client/scripts/ui-shots/shots.js`. Expected: 14+ PNGs written. The output shows `PAGE SCROLL: yes` on the workspace shots (finding S1, before fixes).
- [ ] **Step 5: Commit** `chore: demo seed and screenshot harness for UX work`.

---

## Phase 1 — Foundation: layout, tokens, shell

### Task 1: Tokens and full-height app layout (S1, S4, W9 base)

**Files:**
- Create: `client/src/styles/workspaces.css`
- Create: `client/src/pageTitle.js`, `client/tests/pageTitle.test.js`
- Modify: `client/src/main.js` (import the stylesheet after bootstrap CSS), `client/src/App.vue`, `client/src/router.js`
- Modify: `client/src/views/Workspaces.vue`, `client/src/components/workspaces/WorkspacesSidebar.vue`, `client/src/components/workspaces/WorkspaceMainContent.vue` (styles only)

**Interfaces:**
- Produces: CSS custom properties on `:root`:
  - colors: `--ws-accent`, `--ws-accent-strong`, `--ws-accent-soft`, `--ws-danger`, `--ws-surface` `#fff`, `--ws-surface-muted` `#f4f5f7`, `--ws-border` `#e3e5e8`, `--ws-text` `#1f2328`, `--ws-text-muted` `#6b7280`
  - radii: `--ws-radius-sm` 6px, `--ws-radius` 8px
  - spacing: `--ws-space-1..4` = 4/8/12/16px
  - focus: `--ws-focus` `0 0 0 3px rgba(69,129,92,.35)`
- Produces: the class `.ws-scope` (put on `.workspaces-page`). It maps `.btn-primary`, `.btn-outline-primary`, `.custom-control-input:checked` and `:focus-visible` to the tokens.
- Produces: the route meta flag `fullHeight: true`. `App.vue` then adds `.app--full`, which makes `.main-content` `flex:1; min-height:0; overflow:hidden; padding:0` and hides `<Footer>`.
- Produces: `pageTitle(meta?: { title?: string }) -> string`.

- [ ] **Step 1: Write the failing test.**
```js
import { pageTitle } from "../src/pageTitle";
it("suffixes the app name", () => expect(pageTitle({ title: "Workspaces" })).toBe("Workspaces · Leider chats"));
it("falls back to the app name", () => expect(pageTitle({})).toBe("Leider chats"));
```
- [ ] **Step 2: Run** `npx vitest run tests/pageTitle.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement.**
  - `pageTitle`; `router.beforeEach` uses it.
  - Set the workspaces route meta to `{ title: "Workspaces", fullHeight: true }`.
  - In `App.vue`, bind `:class="{ 'app--full': $route.meta.fullHeight }"` and `<Footer v-if="!$route.meta.fullHeight" />`.
  - Workspace page, sidebar and main pane: replace `height: 100vh` with `height: 100%`. Each pane gets `overflow-y: auto`.
- [ ] **Step 4: Verify.** Run `npx vitest run tests/pageTitle.test.js`: PASS. Then `node scripts/ui-shots/shots.js --only 0`: `PAGE SCROLL: no` on 02, 05 and 06, no footer, and the editor's bottom edge visible in 05. `/chatrooms` and `/` look unchanged (07).
- [ ] **Step 5: Commit** `feat(ui): token stylesheet and full-height workspace layout`.

### Task 2: Header and login hand-off (S2, S3)

**Files:**
- Modify: `client/src/components/Header.vue`, `client/src/views/Login.vue`

- [ ] **Step 1: Header.**
  - Remove the "Projects" link and the search and cart icons.
  - Hide "Workspaces", "Friends" and "Profile" when logged out.
  - Replace the logout icon with `<button class="header-logout" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>` on `@click`, keeping `disconnect()`.
  - Add a style for `.router-link-exact-active` / `.router-link-active`: accent underline, 2px.
- [ ] **Step 2: Login.** Replace the success `Swal.fire` with `this.$toast.success(\`Welcome back, ${username}\`)` and keep the existing redirect. The error/validation alerts stay.
- [ ] **Step 3: Verify.** Run `shots.js --only 01`: no modal after login, the header shows no dead icons, and "Workspaces" is underlined on `/workspaces`.
- [ ] **Step 4: Commit** `fix(ui): remove dead header controls and the blocking login alert`.

### Task 3: One confirm dialog (F1)

**Files:**
- Create: `client/src/workspaces/confirm.js`, `client/tests/confirm.test.js`
- Modify: `client/src/components/workspaces/tasks/TaskEditModal.vue`, `client/src/components/workspaces/ItemList.vue`, `client/src/components/workspaces/whiteboard/WhiteboardCanvas.vue` (drop `ConfirmationModal`)

**Interfaces:**
- Produces: `confirmDanger(bvModal, { title: string, message: string, okTitle: string }) -> Promise<boolean>`. It calls `bvModal.msgBoxConfirm(message, { title, okTitle, okVariant: "danger", cancelTitle: "Cancel", cancelVariant: "outline-secondary", centered: true, returnFocus: document.activeElement })` and resolves `value === true` (a dismissal resolves `false`; a rejection resolves `false`).

- [ ] **Step 1: Write the failing tests** with a fake `bvModal`:
  - the confirm resolves `true` when `msgBoxConfirm` resolves `true`
  - it resolves `false` on `null` (backdrop/Esc) and on a rejection
  - the options passed include `okVariant: "danger"`, `cancelTitle: "Cancel"`, `centered: true`
- [ ] **Step 2: Run** `npx vitest run tests/confirm.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and replace the three usages.** Copy:
  - task: title "Delete task?", message "“<title>” will be deleted for everyone.", ok "Delete task"
  - item: "Delete document?" / "Delete whiteboard?", "“<title>” will be deleted for everyone in this workspace.", ok "Delete"
  - clear: "Clear the whiteboard?", "Every stroke will be removed for everyone.", ok "Clear board"
- [ ] **Step 4: Verify.** The tests PASS. In `shots.js`, add a shot after clicking delete on a document: one centered bootstrap dialog with a red "Delete" and an outlined "Cancel". Esc closes it.
- [ ] **Step 5: Commit** `refactor(ui): single accessible confirm dialog for destructive actions`.

### Task 4: Avatars that never break, and real presence (S5, W6)

**Files:**
- Create: `client/src/workspaces/presence.js`, `client/tests/presence.test.js`
- Modify: `client/src/components/workspaces/UserAvatar.vue`, `client/src/components/workspaces/PresenceBar.vue`, `client/src/components/workspaces/WorkspaceMainContent.vue` (pass `meId`, `detail`)

**Interfaces:**
- Consumes: presence member `{ userId, username, profilePictureUrl, focus: { kind: "task"|"document"|"whiteboard", id } | null }`.
- Produces:
  - `othersHere(members, meId) -> Member[]`: deduped by `userId` (one user, many tabs), excluding me, sorted by username.
  - `presenceLabel(others) -> string`: `[]` gives "Only you here". `[a]` gives "alice is here". `[a,b]` gives "alice and bob are here". 3 or more gives "alice, bob and N others are here".
  - `focusLabel(member, detail) -> string | null`: "Editing Itinerary" for a document, "Drawing on Route sketch" for a whiteboard, "Viewing Book campsites" for a task. `null` when there's no focus or the id isn't found.
- Produces: `UserAvatar` swaps to initials on the `<img>` `error` event. Its background color is `userColor(userId)` when a `userId` prop is given.

- [ ] **Step 1: Write the failing tests** for all three functions, including: a duplicate userId counted once, me excluded, the 3+ wording with N=28 for the seeded chat, and `focusLabel` returning null for an id missing from `detail`.
- [ ] **Step 2: Run** `npx vitest run tests/presence.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** `PresenceBar` shows up to 4 avatars of `othersHere`, then a `+N` chip, then the `presenceLabel` text. Clicking it opens a `b-popover` listing each person with `focusLabel`.
- [ ] **Step 4: Verify.** The tests PASS. In shot 02 (alice alone), the bar reads "Only you here". In a second CDP session as bob focused on "Itinerary", alice's popover reads "bob — Editing Itinerary". To capture that, add a `--as bob` flag to `shots.js` and run it in parallel.
- [ ] **Step 5: Commit** `feat(workspaces): presence that names who is here and what they are on`.

---

## Phase 2 — Navigation and workspace management

### Task 5: URL-driven tabs and open items (W3, W4, W10 tabs)

**Files:**
- Create: `client/src/workspaces/workspaceRoute.js`, `client/tests/workspaceRoute.test.js`
- Modify: `client/src/router.js` (path `/workspaces/:workspaceId?/:tab?/:itemId?`), `client/src/components/workspaces/Tabs.vue`, `client/src/components/workspaces/WorkspaceMainContent.vue`

**Interfaces:**
- Produces:
  - `TABS = [{ slug: "tasks", label: "Tasks" }, { slug: "documents", label: "Documents" }, { slug: "whiteboards", label: "Whiteboards" }]`
  - `parseWorkspaceRoute(params) -> { workspaceId: string|null, tab: "tasks"|"documents"|"whiteboards", itemId: string|null }`: an unknown or missing tab gives `"tasks"`, and `itemId` is `null` on tasks
  - `workspacePath({ workspaceId, tab?, itemId? }) -> string`, e.g. `"/workspaces/abc/documents/d1"`, or `"/workspaces/abc"` for tasks with no item
- Produces: `Tabs` becomes controlled. Props are `tabs: {slug,label,count?}[]` and `value: string`, and it emits `input(slug)`. It renders `role="tablist"`, with `role="tab"` and `aria-selected` on each tab. Left/Right arrows move focus and select.

- [ ] **Step 1: Write the failing tests.** Round-trip `parse(path(x)) == x` for each tab. An unknown tab `"foo"` gives `"tasks"`. A `tasks` route with an itemId gives `itemId: null`. `workspacePath({workspaceId:"w"})` gives `"/workspaces/w"`.
- [ ] **Step 2: Run** `npx vitest run tests/workspaceRoute.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `WorkspaceMainContent` drops `activeTab`, `selectedDocId` and `selectedWbId` from `data` and computes them from `parseWorkspaceRoute(this.$route.params)`.
  - Selecting a tab or item calls `$router.push(workspacePath(...))`.
  - When an item id from the route isn't in `detail` once it's loaded, call `$router.replace` to the tab with no item and show the toast `This <kind> no longer exists` (Review Focus 1).
  - Deleting the open item, or `@closed`, also uses `replace`.
  - Tab counts come from `detail.tasks/documents/whiteboards.length`.
- [ ] **Step 4: Verify.** The tests PASS. With `shots.js`:
  - opening `#/workspaces/<id>/documents/<docId>` directly shows the editor with the Documents tab selected
  - `#/workspaces/<id>/documents/000000000000000000000000` shows the toast, and the URL becomes `/documents`
  - switching workspaces highlights "Tasks"
- [ ] **Step 5: Commit** `feat(workspaces): tab and open item live in the URL`.

### Task 6: Loading and empty states (W2, D4)

**Files:**
- Modify: `client/src/views/Workspaces.vue` (expose `loadingDetail`), `client/src/components/workspaces/WorkspaceMainContent.vue`, `client/src/components/workspaces/EmptyState.vue`

**Interfaces:**
- Produces: `EmptyState` takes props `icon: string` (a Font Awesome class), `title: string`, `body: string`, `actionLabel?: string`, and emits `action`.

- [ ] **Step 1: Implement.**
  - While `workspaceId && !detail && loadingDetail`, render a skeleton: a header bar plus 4 gray column blocks, `aria-busy="true"`.
  - With no workspace selected: icon `fa-table-columns`, "Pick a workspace", "Workspaces belong to a group chat. Open one on the left or start a new one.", action "New workspace" (wired up in Task 7).
  - Documents with none open: "No document open", body "Choose one from the list or create a new one.", action "New document" (focuses the list's create input).
  - Whiteboards: the same pattern.
- [ ] **Step 2: Verify** with shots: throttle by adding `await sleep` inside a CDP `Fetch.requestPaused` for `/api/workspaces/<id>` in a `--slow` mode. The skeleton shows, not the welcome screen.
- [ ] **Step 3: Commit** `feat(workspaces): skeleton while loading and actionable empty states`.

### Task 7: Create a workspace from the Workspaces page (W1)

**Files:**
- Create: `client/src/workspaces/chatOptions.js`, `client/tests/chatOptions.test.js`
- Modify: `client/src/components/workspaces/CreateWorkspaceModal.vue` (`chatroomId` becomes optional and adds a chat picker), `client/src/components/workspaces/WorkspacesSidebar.vue` (a "New workspace" button), `client/src/views/Workspaces.vue` (hosts the modal; on `created`, pushes `workspacePath`)

**Interfaces:**
- Consumes: `fetchChatRooms()` from `client/src/api/ChatRoomService.js`.
- Produces: `groupChatOptions(chats) -> { value: string, text: string }[]`: group chats only (`isGroupChat`), `text` is the chat name or "Unnamed group", sorted by text, case-insensitive.

- [ ] **Step 1: Write the failing tests.** Direct chats are excluded, an unnamed group gets "Unnamed group", and sorting is case-insensitive.
- [ ] **Step 2: Run** `npx vitest run tests/chatOptions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - When `chatroomId` isn't given, the modal shows a required "Group chat" `b-form-select` first. With no group chats, it shows "You need a group chat to create a workspace" and a link to `/chatrooms`.
  - The primary button reads "Create workspace". Fields: name first, then description.
- [ ] **Step 4: Verify.** The tests PASS. In shots, clicking "New workspace" in the sidebar shows the picker. Creating one lands on the new workspace's Tasks tab, and the sidebar lists it.
- [ ] **Step 5: Commit** `feat(workspaces): create a workspace from the Workspaces page`.

### Task 8: Workspace header and settings (W5)

**Files:**
- Create: `client/src/workspaces/permissions.js`, `client/tests/permissions.test.js`
- Create: `client/src/components/workspaces/WorkspaceHeader.vue`
- Modify: `client/src/components/workspaces/WorkspaceMainContent.vue` (uses it, and `canClearSelectedWb` uses `isChatAdminOrCreator`)

**Interfaces:**
- Produces:
  - `isChatAdminOrCreator(detail, meId, createdBy) -> boolean`
  - `canDeleteWorkspace(detail, meId) -> boolean`: creator or chat admin (matches `WorkspaceService.deleteWorkspace`)
- Produces: `WorkspaceHeader` with props `detail`, `members`, `meId`.
  - It shows the name (h1, truncates with a tooltip), the description, and "in <chat name>" linking to `/chatrooms`, then the PresenceBar, then a `b-dropdown` (`aria-label="Workspace settings"`, icon `fa-ellipsis`).
  - Menu: "Rename and describe…", which opens a modal reusing `CreateWorkspaceModal` in edit mode. Edit mode sends `workspace:rename` with `{name, description}`, and has the title "Edit workspace" and the button "Save".
  - "Delete workspace…" appears only if `canDeleteWorkspace`. It goes through `confirmDanger` ("Delete “<name>”?", "Its tasks, documents and whiteboards will be deleted for everyone.", "Delete workspace") and then sends `workspace:delete`.

- [ ] **Step 1: Write the failing tests.** The creator can delete, a chat admin can delete, any other member can't, and a missing `meId` gives `false`.
- [ ] **Step 2: Run** `npx vitest run tests/permissions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** After a successful delete, `$router.push("/workspaces")` and the toast "Workspace deleted". Someone else's delete already reaches the existing `workspace:revoked` flow; check that its toast reads "This workspace was deleted or you lost access". Renames arrive through the existing `workspace:updated` (Review Focus 3).
- [ ] **Step 4: Verify.** The tests PASS. With two CDP sessions (alice and bob): bob renames, and alice's header and sidebar change within a second. Alice deletes, and bob is sent to `/workspaces` with the toast.
- [ ] **Step 5: Commit** `feat(workspaces): rename, describe and delete a workspace`.

### Task 9: Sidebar redesign (W7, W10)

**Files:**
- Create: `client/src/workspaces/workspaceList.js`, `client/tests/workspaceList.test.js`
- Modify: `client/src/components/workspaces/WorkspacesSidebar.vue`

**Interfaces:**
- Produces: `groupWorkspaces(workspaces, query = "") -> { chatRoomId, chatName, workspaces }[]`.
  - It groups by chat (moving the current `groups` computed), keeping the first-seen order of chats and sorting workspaces by name.
  - `query` is trimmed and matched case-insensitively against the workspace name or chat name. Groups left empty are dropped.

- [ ] **Step 1: Write the failing tests.** Grouping, sorting, query by workspace name, query by chat name, and an empty-result drop.
- [ ] **Step 2: Run** `npx vitest run tests/workspaceList.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Width 280px.
  - The header row is "Workspaces" plus an icon button "New workspace" (`aria-label`).
  - A search input appears when there are more than 5 workspaces.
  - Each row is a `<router-link>` to `workspacePath`, with the name plus a one-line muted description, both truncating with `title`.
  - The active row uses the accent-soft background, an accent left border, and accent-strong text.
  - Rows show the focus ring from `.ws-scope`.
- [ ] **Step 4: Verify.** The tests PASS. In shots: the 80-char name truncates, and keyboard Tab from the search reaches each row (`b.key("Tab")` then `document.activeElement.textContent`).
- [ ] **Step 5: Commit** `feat(workspaces): searchable, keyboard-friendly workspace sidebar`.

---

## Phase 3 — Task board

### Task 10: Status and assignees in the task modal (T1, T2)

**Files:**
- Create: `client/src/components/workspaces/tasks/AssigneePicker.vue`
- Modify: `client/src/workspaces/taskBoard.js`, `client/tests/taskBoard.test.js`, `client/src/components/workspaces/tasks/TaskEditModal.vue`, `client/src/components/workspaces/tasks/TaskBoard.vue` (passes `columns`)

**Interfaces:**
- Consumes: `dropOrder(column, draggedId, index)` and `STATUS_LABELS` from `taskBoard.js`. The `task:move(taskId, status, order)` socket event, because `task:update` ignores `status`.
- Produces: `statusOptions() -> { value, text }[]`, in `STATUSES` order with `STATUS_LABELS` text.
- Produces: `appendOrder(columns, status, taskId) -> number`. It returns `dropOrder(columns[status], taskId, columns[status].filter(t => t._id !== taskId).length)`, which puts the task at the end of the target column.
- Produces: `AssigneePicker` with props `participants`, `value: string[]`, `meId`, emitting `input`. It renders a filter input (shown when there are more than 8 participants) and toggle chips (`role="checkbox"`, `aria-checked`): avatar plus name, accent-soft when selected. Then an "Assign to me" link, and a `max-height: 220px; overflow-y: auto` list (Review Focus 5).

- [ ] **Step 1: Write the failing tests.** `statusOptions` gives 4 entries in order. `appendOrder` on an empty column gives a finite number. `appendOrder` on a non-empty column gives a value greater than the last order. The task itself is excluded when it's already in that column.
- [ ] **Step 2: Run** `npx vitest run tests/taskBoard.test.js`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.**
  - The modal adds a "Status" `b-form-select` under Title (for both create and edit).
  - On create, send `status` in `task:create`.
  - On edit: if the status changed, after `task:update` (if there are other changes) send `task:move(id, status, appendOrder(...))`, and emit `item-event` for each ack.
  - Replace the checkbox group with `AssigneePicker`.
  - Footer order: Delete (outline-danger, left), Cancel (outline-secondary), Save (primary).
- [ ] **Step 4: Verify.** The tests PASS. In shots with the 30-participant chat, the picker scrolls inside the modal, and the modal fits in 844px height. Keyboard only: open a card (Enter), Tab to Status, ArrowDown to "Done", Tab to Save, Enter. The card is in Done.
- [ ] **Step 5: Commit** `feat(tasks): change status without dragging; usable assignee picker`.

### Task 11: Readable cards, quick add and full-height columns (T3, T4, T5)

**Files:**
- Modify: `client/src/workspaces/taskBoard.js`, `client/tests/taskBoard.test.js`, `client/src/components/workspaces/tasks/TaskCard.vue`, `client/src/components/workspaces/tasks/TaskBoard.vue`

**Interfaces:**
- Produces: `dueLabel(dueDate: string|null, now = new Date()) -> { text: string, tone: "none"|"soon"|"overdue" } | null`:
  - `null` when there's no due date
  - "Today" or "Tomorrow" with tone `"soon"`
  - in the past: "Overdue · Nov 20", tone `"overdue"`
  - otherwise "Dec 1", or "Jan 3, 2027" when the year differs from `now`'s, tone `"none"`

  It uses the date-only semantics of `dueDateToInput` (no timezone shift).

- [ ] **Step 1: Write the failing tests** for each branch, with a fixed `now = new Date(2026, 10, 27, 23, 30)` (late evening, to catch timezone off-by-one) and a due date of `2026-11-27` giving "Today".
- [ ] **Step 2: Run** `npx vitest run tests/taskBoard.test.js`. Expected: FAIL on `dueLabel`.
- [ ] **Step 3: Implement.**
  - Card: the title clamps to 3 lines with a full `title` tooltip. A `fa-align-left` icon shows when there's a description (`aria-label="Has description"`). The due chip is colored by tone. Assignee avatars carry `title` and `aria-label` with the username. `TaskCard` drops its own `dueLabel` computed.
  - Columns: `display:flex; flex-direction:column; min-height: 100%`. The body grows and is the drop zone. An empty body shows a dashed "Drop tasks here".
  - Quick add: replace the "+ Add task" link with a ghost button "+ Add a task" that turns into an inline input. Enter sends `task:create(workspaceId, { title, status })` and keeps the input open for the next one, Esc closes it, and a "More options" link opens the full modal with the title prefilled.
- [ ] **Step 4: Verify.** The tests PASS. In shots: the overdue chip is red, "Today" is amber, and the 200-char title is clamped. A quick-added task appears without a modal.
- [ ] **Step 5: Commit** `feat(tasks): readable cards, inline quick add, full-height columns`.

---

## Phase 4 — Documents and whiteboards

### Task 12: Document header with sync status (D1, D2)

**Files:**
- Create: `client/src/workspaces/syncStatus.js`, `client/tests/syncStatus.test.js`
- Modify: `client/src/workspaces/SocketYProvider.js` (emit `status` events), `client/tests/SocketYProvider.test.js`, `client/src/components/workspaces/documents/DocumentEditor.vue`, `client/src/components/workspaces/WorkspaceMainContent.vue` (passes `title`, `viewers`, `@rename`)

**Interfaces:**
- Produces: `SocketYProvider` gets the listener event `"status"`, called with `{ connected: boolean, synced: boolean, diverged: boolean, retrying: boolean }` on every change to those fields.
- Produces: `syncLabel(state) -> { text, tone: "ok"|"busy"|"warn"|"error" }`:
  - diverged gives "Not syncing — reload the page" / `error`
  - `!connected` gives "Offline — changes will sync when you reconnect" / `warn`
  - `retrying` gives "Connection problem — retrying…" / `warn`
  - `!synced` gives "Connecting…" / `busy`
  - otherwise "All changes synced" / `ok`
- Produces: `DocumentEditor` takes new props `title: string` and `viewers: Member[]`, and emits `rename(title)`.

- [ ] **Step 1: Write the failing tests.**
  - `syncLabel` for each state, with priority diverged > offline > retrying > connecting.
  - In `SocketYProvider.test.js`: a provider emits `status` with `synced:true` after connect, `connected:false` after `drop()`, and `diverged:true` after an oversized update.
- [ ] **Step 2: Run** `npx vitest run tests/syncStatus.test.js tests/SocketYProvider.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The editor becomes a flex column with height 100%. A header row holds the title (click to rename inline; Enter saves, Esc cancels), the viewer avatars (others only), and a status pill (dot plus `syncLabel` text, `aria-live="polite"`). The status pill replaces the old `.document-status` line.
  - The Quill toolbar comes next, sticky. Then `.ql-container` with `flex:1; overflow-y:auto`.
  - Remove `min-height: 60vh`.
- [ ] **Step 4: Verify.** The tests PASS. In shots: after pasting 200 lines, the toolbar stays visible and only the text area scrolls. Toggling offline (CDP `Network.emulateNetworkConditions` with `offline:true`) shows the amber offline pill.
- [ ] **Step 5: Commit** `feat(documents): editor header with title, viewers and sync status`.

### Task 13: Item list cleanup (D3, F2)

**Files:**
- Modify: `client/src/components/workspaces/ItemList.vue`

- [ ] **Step 1: Implement.**
  - Row actions become one always-visible `b-dropdown` (`aria-label="Document actions"` / `"Whiteboard actions"`, icon `fa-ellipsis-vertical`, variant link) with "Rename" and "Delete…" (red text, via `confirmDanger`).
  - Each row is a `<router-link>` to `workspacePath`.
  - Viewers exclude `meId`.
  - Create: the button reads "+ New" and is never disabled. Submitting empty focuses the input and shows the inline hint "Give it a title first" (`aria-describedby`).
- [ ] **Step 2: Verify.** In shots: actions are visible without hover at 390px, the 120-char title truncates, and an empty submit shows the hint.
- [ ] **Step 3: Commit** `fix(workspaces): visible item actions and clear create validation`.

### Task 14: Whiteboard toolbar (B1, B2, B3)

**Files:**
- Create: `client/src/workspaces/whiteboardUi.js`, `client/tests/whiteboardUi.test.js`
- Modify: `client/src/components/workspaces/whiteboard/WhiteboardCanvas.vue`, `client/src/components/workspaces/WorkspaceMainContent.vue` (passes `members`)

**Interfaces:**
- Produces:
  - `WB_COLORS = [{ name: "Black", hex: "#222222" }, { name: "Red", hex: "#e03131" }, { name: "Blue", hex: "#1c7ed6" }, { name: "Green", hex: "#2f9e44" }, { name: "Yellow", hex: "#f2c94c" }, { name: "Purple", hex: "#7b3fbf" }]`, replacing the component's `COLORS`. The `hex` values must stay accepted by the server's `strokeValidation` color rule; check it.
  - `WB_WIDTHS = [{ name: "Thin", px: 2 }, { name: "Medium", px: 4 }, { name: "Thick", px: 8 }]`
  - `isUndoShortcut(event) -> boolean`: true for `ctrlKey||metaKey` + `z` without shift, and false when `event.target` is an input, textarea or contenteditable
- Consumes: the `userId` on `wb:drawing` payloads, and `members` for usernames.

- [ ] **Step 1: Write the failing tests.** Ctrl+Z true, Cmd+Z true, Ctrl+Shift+Z false, Ctrl+Z in an `INPUT` target false, and every `WB_COLORS.hex` matches `/^#[0-9a-f]{6}$/i`.
- [ ] **Step 2: Run** `npx vitest run tests/whiteboardUi.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Toolbar groups: colors (each `aria-label`/`title` is the color name, with `aria-pressed`), widths (named), an Undo icon button (`fa-rotate-left`, `aria-label="Undo your last stroke (Ctrl+Z)"`), and a `⋯` dropdown holding "Clear board…" (only when `canClear`).
  - A keydown listener on `window` while mounted uses `isUndoShortcut`.
  - Live remote strokes get a small name label in the user's `userColor` at the last point of the stroke.
  - Status becomes a pill overlaid at the canvas's top-left corner: amber offline, red error with a Retry button.
- [ ] **Step 4: Verify.** The tests PASS. In shots: hovering a swatch shows "Red", and a second CDP session drawing slowly shows "bob" next to its live stroke.
- [ ] **Step 5: Commit** `feat(whiteboard): labeled tools, Ctrl+Z, named live strokes`.

---

## Phase 5 — Mobile and entry points

### Task 15: Phone layout (W8, header nav)

**Files:**
- Modify: `client/src/components/Header.vue`, `client/src/views/Workspaces.vue`, `client/src/components/workspaces/WorkspacesSidebar.vue`, `client/src/components/workspaces/WorkspaceMainContent.vue`, `client/src/components/workspaces/Tabs.vue`, `client/src/components/workspaces/tasks/TaskBoard.vue`, `client/src/styles/workspaces.css`

- [ ] **Step 1: Implement** at `max-width: 767.98px`:
  - **Header:** the logo plus a hamburger button (`aria-expanded`) that toggles the nav as a vertical list.
  - **Workspaces page:** with no workspace selected, the sidebar is full width. With one selected, the sidebar is hidden and the workspace header shows a back button "‹ Workspaces" (`aria-label="All workspaces"`) to `/workspaces`.
  - **Tabs:** full-width segmented, `overflow-x:auto`.
  - **Task board:** horizontal `scroll-snap-type: x mandatory`, with columns at `85vw`.
  - **Documents/whiteboards:** the item list shows when there's no `itemId`. With an item open, the list is hidden and the item header gets a back button to the tab.
- [ ] **Step 2: Verify.** Run `shots.js` at 390×844: `PAGE SCROLL: no` with no horizontal overflow (`document.scrollingElement.scrollWidth <= innerWidth`) on every 08-* shot. Every action from Tasks 5–14 is reachable: open a task, change its status, open a document, go back.
- [ ] **Step 3: Commit** `feat(ui): phone layout for workspaces and header`.

### Task 16: Workspaces from chats (C1)

**Files:**
- Modify: `server/src/models/chatrooms/Message.ts` (add an optional `workspaceId: ObjectId`), `server/src/services/workspaces/WorkspaceService.ts` (set it on the system message), `server/tests/services/workspaces/WorkspaceService.test.ts`
- Modify: `client/src/components/chatroom/MessageItem.vue` (system message with `workspaceId` gets a link), `client/src/views/ChatRoom.vue` (a top-bar "Workspaces" button)

**Interfaces:**
- Produces: system messages created by `createWorkspace` carry `workspaceId`. Old messages don't, and render as plain text.

- [ ] **Step 1: Write the failing server test.** `createWorkspace(...)` returns a `message` whose `workspaceId` equals the created workspace's `_id`.
- [ ] **Step 2: Run** `cd server && npx jest tests/services/workspaces/WorkspaceService.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Server: the schema field and setting it.
  - Client: a system message with `workspaceId` renders as "alice created the workspace" plus a `<router-link :to="workspacePath({workspaceId})">` on the name.
  - The chat top bar (group chats only) gets a "Workspaces" button with a count badge. It opens the details drawer scrolled to `ChatWorkspaces` (`scrollIntoView` on a `ref`).
- [ ] **Step 4: Verify.** The server test PASSES and the full `npx jest` has no new failures. In shots: clicking the workspace name in the chat opens it, and the top-bar button reveals the list.
- [ ] **Step 5: Commit** `feat(chat): link to workspaces from chat messages and header`.

---

## Finding → task map

| Findings | Task |
|---|---|
| S1, S4, W9 | 1 |
| S2, S3 | 2 |
| F1 | 3 |
| S5, W6 | 4 |
| W3, W4, W10 (tabs) | 5 |
| W2, D4 | 6 |
| W1 | 7 |
| W5 | 8 |
| W7, W10 (sidebar) | 9 |
| T1, T2 | 10 |
| T3, T4, T5 | 11 |
| D1, D2 | 12 |
| D3, F2, W10 (items) | 13 |
| B1, B2, B3 | 14 |
| W8 | 15 |
| C1 | 16 |
