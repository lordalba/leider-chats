/**
 * The one confirmation dialog for destructive actions in workspaces: a
 * bootstrap-vue message box (Esc, focus trap and focus return built in).
 * Resolves true only when the user clicks the confirm button.
 *
 * @param bvModal  `this.$bvModal` of the calling component
 * @param {{ title: string, message: string, okTitle: string }} ask
 */
export async function confirmDanger(bvModal, { title, message, okTitle }) {
  try {
    const value = await bvModal.msgBoxConfirm(message, {
      title,
      okTitle,
      okVariant: "danger",
      cancelTitle: "Cancel",
      cancelVariant: "outline-secondary",
      centered: true,
      contentClass: "ws-scope",
      returnFocus: typeof document !== "undefined" ? document.activeElement : undefined,
    });
    return value === true;
  } catch {
    // The calling component was destroyed while the box was open.
    return false;
  }
}
