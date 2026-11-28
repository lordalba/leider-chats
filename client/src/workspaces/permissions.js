// Client-side mirrors of the server's permission rules, used only to decide
// which actions to offer (the server still enforces them).

// The given creator, or an admin of the workspace's chat.
export function isChatAdminOrCreator(detail, meId, createdBy) {
  if (!detail || !meId) return false;
  const me = String(meId);
  if (createdBy != null && String(createdBy) === me) return true;
  const admins = (detail.chat && detail.chat.admins) || [];
  return admins.some((admin) => String(admin) === me);
}

// Matches WorkspaceService.deleteWorkspace: the creator or a chat admin.
export function canDeleteWorkspace(detail, meId) {
  if (!detail || !detail.workspace) return false;
  return isChatAdminOrCreator(detail, meId, detail.workspace.createdBy);
}
