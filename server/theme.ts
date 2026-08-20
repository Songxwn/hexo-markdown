export const THEME_IDS = ["ink", "paper", "midnight", "celadon"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "ink";

export const THEME_LABELS: Record<ThemeId, string> = {
  ink: "墨色",
  paper: "宣纸",
  midnight: "夜航",
  celadon: "青瓷",
};

export const THEME_CHROME: Record<ThemeId, { bg: string; overlay: string; symbol: string }> = {
  ink: { bg: "#100e0c", overlay: "#161310", symbol: "#f3ede1" },
  paper: { bg: "#f4efe6", overlay: "#efe8dc", symbol: "#3a3329" },
  midnight: { bg: "#0e1218", overlay: "#141922", symbol: "#e8edf5" },
  celadon: { bg: "#101614", overlay: "#151c19", symbol: "#e7f0ea" },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function normalizeTheme(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}
