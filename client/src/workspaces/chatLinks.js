// The server writes `<user> created the workspace "<name>"` (WorkspaceService
// createWorkspace). Split it so the chat can turn the name into a link.
// Names may contain quotes, so everything between the quote after the
// phrase and the final quote is the name.
const CREATED = /^([\s\S]* created the workspace )"([\s\S]*)"$/;

export function workspaceMessageParts(content) {
  const match = CREATED.exec(String(content || ""));
  if (!match) return null;
  return { before: match[1], name: match[2], after: "" };
}
