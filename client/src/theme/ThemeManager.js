const STORAGE_KEY = "theme";
const DARK = "dark";
const LIGHT = "light";

/**
 * Light/dark mode. The choice is saved in localStorage and applied as a `dark` class on <html>,
 * which switches the CSS variables in styles/theme.css. Without a saved choice, it follows the OS.
 */
class ThemeManager {
  constructor(storage = window.localStorage, root = document.documentElement) {
    this.storage = storage;
    this.root = root;
    this.listeners = new Set();
  }

  get theme() {
    const saved = this.storage.getItem(STORAGE_KEY);
    if (saved === DARK || saved === LIGHT) return saved;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? DARK : LIGHT;
  }

  get isDark() {
    return this.theme === DARK;
  }

  /** Applies the current theme to the page. Call once at startup. */
  apply() {
    this.root.classList.toggle(DARK, this.isDark);
    this.listeners.forEach((listener) => listener(this.theme));
  }

  toggle() {
    this.storage.setItem(STORAGE_KEY, this.isDark ? LIGHT : DARK);
    this.apply();
  }

  /** Calls `listener(theme)` whenever the theme changes. Returns an unsubscribe function. */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export default new ThemeManager();
