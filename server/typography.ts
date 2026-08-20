export const FONT_IDS = ["default", "system", "sans", "serif", "kai", "mono"] as const;

export type FontFamilyId = (typeof FONT_IDS)[number];

export const DEFAULT_FONT_FAMILY: FontFamilyId = "default";
export const DEFAULT_FONT_SIZE = 14;
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 20;
export const FONT_SIZE_STEPS = [12, 13, 14, 15, 16, 18, 20] as const;

export const FONT_LABELS: Record<FontFamilyId, string> = {
  default: "默认",
  system: "系统",
  sans: "黑体",
  serif: "宋体",
  kai: "楷体",
  mono: "等宽",
};

export function isFontFamilyId(value: unknown): value is FontFamilyId {
  return typeof value === "string" && (FONT_IDS as readonly string[]).includes(value);
}

export function normalizeFontFamily(value: unknown): FontFamilyId {
  return isFontFamilyId(value) ? value : DEFAULT_FONT_FAMILY;
}

export function normalizeFontSize(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_FONT_SIZE;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)));
}

export function stepFontSize(current: unknown, delta: number): number {
  return normalizeFontSize(normalizeFontSize(current) + delta);
}
