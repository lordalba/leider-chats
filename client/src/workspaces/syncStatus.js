// The document header's sync pill, from SocketYProvider's status().
// Priority: diverged > offline > retrying > connecting > synced.
export function syncLabel(state) {
  const s = state || {};
  if (s.diverged) return { text: "Not syncing — reload the page", tone: "error" };
  if (s.connected === false) {
    return { text: "Offline — changes will sync when you reconnect", tone: "warn" };
  }
  if (s.retrying) return { text: "Connection problem — retrying…", tone: "warn" };
  if (!s.synced) return { text: "Connecting…", tone: "busy" };
  return { text: "All changes synced", tone: "ok" };
}
