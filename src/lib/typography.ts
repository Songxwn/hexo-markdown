export const FONT_IDS = ["default", "system", "sans", "serif", "kai", "mono"] as const;

export type FontFamilyId = (typeof FONT_IDS)[number];

export const DEFAULT_FONT_FAMILY: FontFamilyId = "default";
export const DEFAULT_FONT_SIZE = 14;
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 20;
export const FONT_SIZE_BASE = 14;
export const FONT_SIZE_STEPS = [12, 13, 14, 15, 16, 18, 20] as const;

export const FONT_STORAGE_KEY = "hexo-font";
export const FONT_SIZE_STORAGE_KEY = "hexo-font-size";

export const FONT_LABELS: Record<FontFamilyId, { name: string; desc: string; sample: string }> = {
  default: { name: "默认", desc: "无衬线界面，楷体预览", sample: "汉字 Abc 123" },
  system: { name: "系统", desc: "跟随操作系统", sample: "汉字 Abc 123" },
  sans: { name: "黑体", desc: "思源黑体 / 微软雅黑", sample: "汉字 Abc 123" },
  serif: { name: "宋体", desc: "思源宋体 / 宋体", sample: "汉字 Abc 123" },
  kai: { name: "楷体", desc: "霞鹜文楷 / 楷体", sample: "汉字 Abc 123" },
  mono: { name: "等宽", desc: "界面与正文都偏等宽", sample: "汉字 Abc 123" },
};

const STACKS: Record<FontFamilyId, { ui: string; preview: string; mono: string; display: string; serif: string }> = {
  default: {
    ui: '"Inter", "Noto Sans SC", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif',
    preview: '"LXGW WenKai", "Source Serif 4", "Noto Serif SC", "Songti SC", "STSong", serif',
    mono: '"JetBrains Mono", "IBM Plex Mono", "Cascadia Code", "Sarasa Gothic SC", Consolas, monospace',
    display: '"Fraunces", "Noto Serif SC", "Songti SC", serif',
    serif: '"Source Serif 4", "Noto Serif SC", "Songti SC", "STSong", serif',
  },
  system: {
    ui: 'system-ui, "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif',
    preview: 'system-ui, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif',
    mono: 'ui-monospace, "Cascadia Code", "Cascadia Mono", Consolas, monospace',
    display: 'system-ui, "Microsoft YaHei UI", sans-serif',
    serif: '"Noto Serif SC", "Songti SC", SimSun, serif',
  },
  sans: {
    ui: '"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei UI", "PingFang SC", sans-serif',
    preview: '"Noto Sans SC", "Microsoft YaHei UI", "PingFang SC", sans-serif',
    mono: '"JetBrains Mono", "Sarasa Gothic SC", Consolas, monospace',
    display: '"Noto Sans SC", "Microsoft YaHei UI", sans-serif',
    serif: '"Noto Serif SC", "Songti SC", serif',
  },
  serif: {
    ui: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
    preview: '"Noto Serif SC", "Source Serif 4", "Songti SC", SimSun, serif',
    mono: '"JetBrains Mono", Consolas, monospace',
    display: '"Noto Serif SC", "Songti SC", serif',
    serif: '"Noto Serif SC", "Songti SC", SimSun, serif',
  },
  kai: {
    ui: '"LXGW WenKai", "KaiTi", "STKaiti", "Noto Serif SC", serif',
    preview: '"LXGW WenKai", "KaiTi", "STKaiti", "Noto Serif SC", serif',
    mono: '"JetBrains Mono", Consolas, monospace',
    display: '"LXGW WenKai", "KaiTi", serif',
    serif: '"LXGW WenKai", "Noto Serif SC", serif',
  },
  mono: {
    ui: '"JetBrains Mono", "Noto Sans SC", "Microsoft YaHei UI", sans-serif',
    preview: '"JetBrains Mono", "Noto Sans SC", "Microsoft YaHei UI", sans-serif',
    mono: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    display: '"JetBrains Mono", "Noto Sans SC", sans-serif',
    serif: '"Noto Serif SC", "Songti SC", serif',
  },
};

export function fontStack(id: FontFamilyId, role: "ui" | "preview" | "mono" | "display" | "serif" = "preview"): string {
  return STACKS[normalizeFontFamily(id)][role];
}

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

export type Typography = {
  fontFamily: FontFamilyId;
  fontSize: number;
};

export function readCachedTypography(): Typography {
  try {
    return {
      fontFamily: normalizeFontFamily(localStorage.getItem(FONT_STORAGE_KEY)),
      fontSize: normalizeFontSize(localStorage.getItem(FONT_SIZE_STORAGE_KEY)),
    };
  } catch {
    return { fontFamily: DEFAULT_FONT_FAMILY, fontSize: DEFAULT_FONT_SIZE };
  }
}

export function applyTypography(
  fontFamily: FontFamilyId | string | null | undefined,
  fontSize: number | string | null | undefined,
  options?: { persist?: boolean },
): Typography {
  const family = normalizeFontFamily(fontFamily);
  const size = normalizeFontSize(fontSize);
  const scale = size / FONT_SIZE_BASE;
  const stack = STACKS[family];
  const root = document.documentElement;
  root.dataset.font = family;
  root.style.setProperty("--font-scale", String(scale));
  root.style.setProperty("--app-font-size", `${size}px`);
  root.style.setProperty("--cm-font-size", `${(15 * scale).toFixed(2)}px`);
  root.style.setProperty("--preview-font-size", `${(18 * scale).toFixed(2)}px`);
  root.style.setProperty("--ui", stack.ui);
  root.style.setProperty("--preview", stack.preview);
  root.style.setProperty("--mono", stack.mono);
  root.style.setProperty("--display", stack.display);
  root.style.setProperty("--serif", stack.serif);
  if (options?.persist !== false) {
    try {
      localStorage.setItem(FONT_STORAGE_KEY, family);
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(size));
    } catch {
      /* ignore */
    }
  }
  return { fontFamily: family, fontSize: size };
}
