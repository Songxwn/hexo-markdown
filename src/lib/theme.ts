export const THEME_IDS = ["ink", "paper", "midnight", "celadon"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "ink";

export const THEME_STORAGE_KEY = "hexo-theme";

export const THEMES: { id: ThemeId; name: string; desc: string; swatches: [string, string, string] }[] = [
  { id: "ink", name: "墨色", desc: "暖色暗色，默认", swatches: ["#100e0c", "#d7ab78", "#f3ede1"] },
  { id: "paper", name: "宣纸", desc: "浅色纸感阅读", swatches: ["#f4efe6", "#a36b3a", "#3a3329"] },
  { id: "midnight", name: "夜航", desc: "冷色暗色", swatches: ["#0e1218", "#7eb6d9", "#e8edf5"] },
  { id: "celadon", name: "青瓷", desc: "青绿暗色", swatches: ["#101614", "#7eb89a", "#e7f0ea"] },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function normalizeTheme(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export function readCachedTheme(): ThemeId {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: ThemeId, options?: { persist?: boolean; chrome?: boolean }) {
  const id = normalizeTheme(theme);
  document.documentElement.dataset.theme = id;
  document.documentElement.style.colorScheme = id === "paper" ? "light" : "dark";
  if (options?.persist !== false) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }
  if (options?.chrome !== false) {
    window.hexo?.setTheme?.(id);
  }
}
