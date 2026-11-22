# Collaborative Workspaces — Design

Date: 2026-11-22

## Goal
Participants of a chat can create workspaces and work in them together, at the same time, with every change visible to everyone live.

## Decisions (from the product owner)
1. **A workspace belongs to a chat.** You create it from inside a chatroom. Its members are exactly that chat's participants, now and in the future: joining the chat grants access and leaving or being removed revokes it. Creating a workspace posts a system message in the chat.
2. **Content in v1: shared documents, a task board, and whiteboards.** These are built one at a time, in this order: foundation → task board → documents → whiteboard. Each phase ships on its own.
3. **Documents use Yjs CRDT.** Concurrent typing merges without loss, and you see live remote cursors with names. Document state is persisted to Mongo as a binary Yjs update.
4. **Presence.** The workspace shows avatars of the members who have it open right now. Each document, task and whiteboard shows a badge for anyone currently focused on it.

## Behaviour
- **Task board:** columns `todo / inProgress / verify / done` (the existing `TaskStatus`). You can create, edit (title, description, assignees, due date), drag between and within columns, and delete. Concurrent edits to the same task are last-write-wins per request.
- **Whiteboard:** freehand pen strokes with colour and width. Other people's strokes appear live while they are still drawing. You can undo your own last stroke. The whiteboard's creator or a chat admin can clear the board.
- **Deleting a workspace** is allowed for its creator or a chat admin, and removes all of its contents. Deleting a chat deletes its workspaces.
- **Reads go over REST, writes go over Socket.IO with acks.** The server checks membership on every write.

## Out of scope (v1)
Per-workspace roles, comments, version history, file attachments in workspaces, offline-first storage on the client.
