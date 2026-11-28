# Workspaces UX/UI Audit

**Date:** 2026-11-27
**Scope:** the collaborative workspaces feature (`/workspaces`, task board, documents, whiteboard), the app shell it lives in (layout, header, footer, login hand-off, page title), and the entry points from chats. Issues found on other pages are listed under **Out of scope** at the end, so they are recorded but not planned.
**Method:** each component was read in full. A seeded workspace was then screenshotted at 1440×900 and 390×844 (headless Chromium over CDP; the harness is in plan Task 0).

Every finding has an ID. The plan refers to these IDs.

## Design direction (decisions)

- **One accent: the app's green.** The brand color is the existing green (`#45815c`, with `#2f5e43` for hover/active). Bootstrap blue (`#007bff`, primary buttons) no longer appears in workspace UI. Red is used only for destructive actions.
- **Tokens over ad-hoc colors.** All workspace styling uses CSS custom properties from one file (see plan Task 1). No hex literals in workspace components except the user-pickable whiteboard palette and cursor colors.
- **The app view fills the screen.** `/workspaces` fills the viewport under the header. There's no page scrollbar and no footer, and each pane scrolls on its own.
- **The URL is the state.** The workspace, tab and open document/whiteboard all live in the route, so refresh, back/forward and shared links work.
- **Every action works without drag and without hover.** Anything possible by drag-and-drop or hover-revealed icons can also be done by click/tap and keyboard.
- **No new npm dependencies.** The registry is blocked by TLS interception on this machine. Use bootstrap-vue (`b-dropdown`, `b-modal`, `$bvModal.msgBoxConfirm`, `b-badge`, `b-sidebar`), Font Awesome, and Quill, which are already installed.

## Findings

Severity: **P1** blocks or misleads a user · **P2** clearly bad, has a workaround · **P3** polish.

### Shell and layout (S)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S1 | P1 | **Nested scrolling and a footer inside an app view.** `#app` is `100vh; overflow:hidden`. `.main-content` scrolls. The workspace sidebar and main pane are each `height:100vh` *inside* that, under an 100px header. So the page shows its own scrollbar, both panes run under the footer, and the footer permanently takes ~65px. | `App.vue` global block, `Workspaces.vue .workspaces-page`, `WorkspacesSidebar .workspaces-sidebar`, `WorkspaceMainContent .workspace-main`; screenshots 03, 07 (right-edge scrollbar, editor cut off by footer) |
| S2 | P2 | **Header has dead and duplicate controls.** "Projects" links to `/friends`, a duplicate of "Friends". The search and cart icons do nothing. Logout is an unlabeled `fa-user-slash` icon that fires on `mousedown`. "Workspaces" shows when logged out. | `Header.vue` |
| S3 | P2 | **Login success is a blocking modal.** "good job! / Logged in successful!" needs an OK click. Its footer link reads "why is your mother in a pita?" and points to a URL shortener, and the modal stays up across navigation. | `Login.vue:77-83`; screenshots 02/03 first run |
| S4 | P3 | **Wrong page titles.** `/workspaces` is titled "chat with your friends". The fallback title is "Letter for every soldier". | `router.js` |
| S5 | P2 | **Broken images show alt text.** A missing profile/chat image shows "Profile picture", "User" or "Chatroom" text. `UserAvatar` has no image error fallback either. | screenshot 16; `UserAvatar.vue` |

### Workspaces page (W)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| W1 | P1 | **The empty state promises an action the page doesn't have.** It says "Select a workspace or create a new one". But you can only create a workspace from a chat's details panel, which is hidden behind "click to watch GroupChat details". The sidebar hint says this, the main pane doesn't. | `EmptyState.vue`, `WorkspacesSidebar.vue`, screenshot 02 |
| W2 | P2 | **Loading flashes the welcome screen.** While a workspace loads, `detail` is `null`, so "Welcome to the Workspaces Dashboard" renders and then jumps to the board. The sidebar shows a bare "Loading…". | `WorkspaceMainContent` `v-else` EmptyState |
| W3 | P1 | **Tab and open item aren't in the URL.** A refresh drops you on Tasks with nothing open. You can't link a teammate to a document. Back/forward skip tab and item changes. | `WorkspaceMainContent` keeps `activeTab`, `selectedDocId`, `selectedWbId` in `data` |
| W4 | P1 | **Tab highlight desyncs from content.** `Tabs.vue` keeps its own `activeTab`. When the workspace changes, the parent resets to Tasks but the tab strip still highlights the old tab. | `Tabs.vue` `data.activeTab`; `WorkspaceMainContent` `watch.workspaceId` |
| W5 | P1 | **Workspaces can't be renamed, re-described or deleted from the UI.** The server supports `workspace:rename` (any member) and `workspace:delete` (creator or chat admin). | `workspaceHandler.ts`, `WorkspaceService.ts` |
| W6 | P2 | **Presence tells you almost nothing.** The bar is a row of unlabeled avatars that includes yourself. There's no names, no count, no "only you here", and no hint of who's on which tab or item. | `PresenceBar.vue`, screenshot 03 (one avatar: yourself) |
| W7 | P2 | **The sidebar is wide, mouse-only and bare.** It's a fixed 350px. Rows are `li @click`: not focusable, no role. There are no item counts or descriptions, no search, and no create button. | `WorkspacesSidebar.vue` |
| W8 | P1 | **Unusable on phones.** At 390px the 350px sidebar leaves the workspace a ~20px strip. The header nav overflows off-screen. | screenshots 13, 14 |
| W9 | P2 | **The visual language is inconsistent.** Tabs and primary buttons are blue, the active workspace pill is dark green, "+ Add task" is a green underlined link, and confirm dialogs have red Delete with cyan Cancel. Spacing and radii vary per component. | screenshots 03, 07, 08 |
| W10 | P2 | **Accessibility gaps.** Clickable `li`/`div` have no role or tabindex (sidebar rows, item rows). Icon-only buttons rely on `title`. There's no visible focus style, and the tabs lack `role="tablist"`. | `WorkspacesSidebar`, `ItemList`, `Tabs` |

### Confirm dialogs and feedback (F)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F1 | P2 | **Two dialog systems.** The custom `ConfirmationModal` (no Esc, no focus trap, cyan Cancel) is stacked on top of a bootstrap `b-modal` when deleting a task. Bootstrap modals are used elsewhere. | `TaskEditModal.vue`, `ItemList.vue`, `WhiteboardCanvas.vue`; screenshot 08 |
| F2 | P3 | **Disabled primary buttons look broken.** "Add" and "Create" render as a pale blue block when there's no title yet, with no hint why. | screenshots 06, 17 |

### Task board (T)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| T1 | P1 | **Status can only change by drag-and-drop.** The task modal has no status field, so keyboard and touch users can't move a task at all. | `TaskEditModal.vue` |
| T2 | P2 | **The assignee picker is a bare checkbox list.** Native checkboxes are glued to names (`☑alice`), with no avatars and no "assign to me". It grows without limit with chat size. | screenshot 04 |
| T3 | P2 | **Cards hide who and what.** Assignees are avatars with only a hover title. Nothing shows that a card has a description. The due date has no year and no "today/overdue" wording. | `TaskCard.vue`, screenshot 03 |
| T4 | P2 | **Adding a task always takes a modal.** "+ Add task" (an underlined link in each column) opens the full modal even for a title-only task. There's no inline quick-add. | `TaskBoard.vue` |
| T5 | P3 | **Columns don't use the height.** Columns end where their cards end, so the empty space below isn't a drop target. Empty columns show no hint. | screenshot 03 |

### Documents (D)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| D1 | P1 | **The editor has no header.** You only know which document is open from the list highlight. There's no title, no rename-in-place, no "Saved / Syncing / Offline" indicator (status text appears only on problems), and no "who's here" for this document. | `DocumentEditor.vue`, screenshot 07 |
| D2 | P2 | **The toolbar scrolls away.** The editor is `min-height:60vh` inside a scrolling page, so long documents scroll the toolbar and header out of view. | `DocumentEditor.vue` styles |
| D3 | P2 | **Item rows are cluttered and risky.** Blue pen and trash icons sit at 40% opacity and only reach full strength on hover, so there's no affordance on touch. Delete sits next to Rename. The viewers avatars include yourself. | `ItemList.vue`, screenshot 07 |
| D4 | P3 | **Weak empty states.** It says "No documents yet." in the list and "Pick a document, or create one." in gray in the pane, with no button. | `ItemList.vue`, `WorkspaceMainContent.vue` |

### Whiteboard (B)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B1 | P2 | **The toolbar is unlabeled and unbalanced.** Color swatches have hex codes as titles (`#e6194b`), and widths have no names. "Undo my last stroke" is a long text button. There's no Ctrl/Cmd+Z, and "Clear board" sits in red right next to Undo. | `WhiteboardCanvas.vue`, screenshot 09 |
| B2 | P2 | **Live drawing is anonymous.** Other people's in-progress strokes appear with no indication of who is drawing. | `WhiteboardCanvas.onRemoteDrawing` |
| B3 | P3 | **Status is easy to miss.** "Offline — reconnecting…" and errors are small gray text in the toolbar. | `.wb-status` |

### Chat → workspace entry (C)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| C1 | P2 | **Workspaces are buried in chats.** The workspace list and "New workspace" live inside the details drawer, opened only by clicking the chat header ("click to watch GroupChat details"). The system messages "alice created the workspace …" aren't links. | screenshots 15, 16; `ChatroomSidebar.vue` |

## Out of scope (recorded, not planned)

- The same nested-scroll layout on `/chatrooms` (S1 there). This plan's layout fix is opt-in per route, so `/chatrooms` can adopt it later.
- Chat page: "create new chat" pill style, the "Welcome to the Leider chats Chatrooms!" hero, "Send Location" in orange beside the input, and "Admin-Only Mode" as a red toggle.
- Login/Register forms: the "Login In" button label, and the "All fields must be filled before creating an account" text shown on the login page.
- Console errors on `/chatrooms`: `MessageList` gets `chatroomId: null`, and the `participantsAmount` watcher throws.
- Features beyond UX repair: task filters ("my tasks"), whiteboard eraser/redo/export, document version history.
