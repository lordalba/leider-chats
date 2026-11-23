const BASE = process.env.BASE_URL || "/";

/** Shown whenever a user has no picture, or theirs fails to load. */
export const DEFAULT_AVATAR = `${BASE}default-avatar.svg`;
/** Shown whenever a group chat has no picture, or its picture fails to load. */
export const DEFAULT_GROUP_AVATAR = `${BASE}default-group.png`;

const fallbackFor = (kind) => (kind === "group" ? DEFAULT_GROUP_AVATAR : DEFAULT_AVATAR);

const useFallback = (el) => {
  // Absolute URL comparison avoids an endless error loop if the fallback itself fails.
  const fallback = new URL(fallbackFor(el._avatarKind), window.location.href).href;
  if (el.src !== fallback) el.src = fallback;
};

const check = (el, binding) => {
  el._avatarKind = binding.value;
  if (!el.getAttribute("src")) useFallback(el);
};

/**
 * `<img v-avatar :src="user.profilePictureUrl">` shows the default picture when the address is
 * empty or the image can't be loaded. Use `v-avatar="'group'"` for group chat pictures.
 */
export const avatarDirective = {
  bind(el, binding) {
    el._avatarKind = binding.value;
    el._avatarOnError = () => useFallback(el);
    el.addEventListener("error", el._avatarOnError);
  },
  inserted: check,
  componentUpdated: check,
  unbind(el) {
    el.removeEventListener("error", el._avatarOnError);
    delete el._avatarOnError;
    delete el._avatarKind;
  },
};
