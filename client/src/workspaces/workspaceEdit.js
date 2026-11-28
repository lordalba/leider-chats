// Limits match the server's WorkspaceService (validateName/validateDescription).
export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;

/** What's wrong with the form, in words, or null when it can be sent. */
export function workspaceFieldError({ name, description }) {
  const n = String(name || "").trim();
  const d = String(description || "").trim();
  if (!n) return "Give the workspace a name first";
  if (n.length > NAME_MAX) return `Names can be up to ${NAME_MAX} characters`;
  if (d.length > DESCRIPTION_MAX) return `Descriptions can be up to ${DESCRIPTION_MAX} characters`;
  return null;
}

/**
 * The rename patch for an edit: only the fields the user changed since the
 * form opened, so a concurrent rename by someone else isn't overwritten.
 */
export function workspacePatch(opened, current) {
  const patch = {};
  const name = String(current.name || "").trim();
  const description = String(current.description || "").trim();
  if (name !== String(opened.name || "").trim()) patch.name = name;
  if (description !== String(opened.description || "").trim()) patch.description = description;
  return patch;
}
