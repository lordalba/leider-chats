// The document header's sync pill, from SocketYProvider's status().
// Priority: diverged > offline > retrying > connecting > synced.
export function syncLabel(state) {
  const s = state || {};
  // `short` is for phones, where the full text would squeeze the title.
  if (s.diverged) {
    return { text: "Not syncing — reload the page", short: "Not syncing", tone: "error" };
  }
  if (s.connected === false) {
    return { text: "Offline — changes will sync when you reconnect", short: "Offline", tone: "warn" };
  }
  if (s.retrying) {
    return { text: "Connection problem — retrying…", short: "Retrying…", tone: "warn" };
  }
  if (!s.synced) return { text: "Connecting…", short: "Connecting…", tone: "busy" };
  return { text: "All changes synced", short: "Synced", tone: "ok" };
}
