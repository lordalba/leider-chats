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
