// The workspace screen's state lives in the URL:
//   /workspaces/:workspaceId?/:tab?/:itemId?
// so refresh, back/forward and shared links land on the same tab and item.
export const TABS = [
  { slug: "tasks", label: "Tasks" },
  { slug: "documents", label: "Documents" },
  { slug: "whiteboards", label: "Whiteboards" },
];

const SLUGS = TABS.map((t) => t.slug);

export function parseWorkspaceRoute(params = {}) {
  const tab = SLUGS.includes(params.tab) ? params.tab : "tasks";
  return {
    workspaceId: params.workspaceId || null,
    tab,
    // Tasks open in a modal, not as a routed item.
    itemId: tab === "tasks" ? null : params.itemId || null,
  };
}

export function workspacePath({ workspaceId, tab = "tasks", itemId } = {}) {
  if (!workspaceId) return "/workspaces";
  const base = `/workspaces/${workspaceId}`;
  if (!SLUGS.includes(tab) || tab === "tasks") return base;
  return itemId ? `${base}/${tab}/${itemId}` : `${base}/${tab}`;
}

/**
 * The tidy path for a workspace URL that isn't (an unknown tab, or an item id
 * on the tasks tab), or null when it already is.
 */
export function canonicalWorkspacePath(params = {}) {
  if (!params.workspaceId) return null;
  const parsed = parseWorkspaceRoute(params);
  const canonical = workspacePath(parsed);
  const given = workspacePath({ workspaceId: params.workspaceId, tab: params.tab, itemId: params.itemId });
  const unknownTab = params.tab && params.tab !== parsed.tab;
  const strayItem = parsed.tab === "tasks" && (params.tab || params.itemId);
  return unknownTab || strayItem || given !== canonical ? canonical : null;
}
