export const APP_NAME = "Leider chats";

/** Browser tab title for a route: "<page> · Leider chats", or just the app name. */
export function pageTitle(meta) {
  const title = meta && meta.title;
  return title ? `${title} · ${APP_NAME}` : APP_NAME;
}
