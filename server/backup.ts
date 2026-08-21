import { loadConfig, saveConfig } from "./config";
import { listTemplates, saveTemplates } from "./templates";
import { normalizeTheme } from "./theme";
import { normalizeFontFamily, normalizeFontSize } from "./typography";
import type { AppConfig, PostTemplate } from "./types";

export const BACKUP_APP = "hexo-markdown";
export const BACKUP_FORMAT = 1;

export type ConfigBackup = {
  app: string;
  format: number;
  exportedAt: string;
  settings: AppConfig;
  templates: { defaultId: string; items: PostTemplate[] };
};

const STRING_KEYS: (keyof AppConfig)[] = [
  "hexoRoot",
  "r2AccountId",
  "r2AccessKeyId",
  "r2SecretAccessKey",
  "r2Bucket",
  "r2PublicUrl",
  "r2KeyPrefix",
  "sshHost",
  "sshUser",
  "sshPassword",
  "sshPrivateKeyPath",
  "sshPassphrase",
  "remoteHexoRoot",
  "sshInitCmd",
  "sshGenerateCmd",
  "sshDeployCmd",
  "llmBaseUrl",
  "llmApiKey",
  "llmModel",
];

const SECRET_KEYS = new Set<keyof AppConfig>([
  "r2SecretAccessKey",
  "sshPassword",
  "sshPassphrase",
  "llmApiKey",
]);

function isMaskedSecret(value: string): boolean {
  return value.includes("••••");
}

export function buildConfigBackup(): ConfigBackup {
  const settings = loadConfig();
  const templates = listTemplates();
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
    templates: { defaultId: templates.defaultId, items: templates.items },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function looksLikeSettings(data: Record<string, unknown>): boolean {
  return STRING_KEYS.some((key) => typeof data[key] === "string") || typeof data.sshPort === "number";
}

export function parseConfigBackup(raw: unknown): {
  settings: Record<string, unknown>;
  templates?: { defaultId?: string; items?: PostTemplate[] };
} {
  const data = asRecord(raw);
  if (!data) throw new Error("不是有效的配置文件");

  if (typeof data.app === "string" && data.app !== BACKUP_APP) {
    throw new Error("这不是 Hexo Markdown 的配置文件");
  }

  const nested = asRecord(data.settings);
  if (data.app === BACKUP_APP || nested) {
    if (!nested) throw new Error("配置文件缺少 settings");
    const templates = asRecord(data.templates) || undefined;
    return {
      settings: nested,
      templates: templates
        ? {
            defaultId: typeof templates.defaultId === "string" ? templates.defaultId : undefined,
            items: Array.isArray(templates.items) ? (templates.items as PostTemplate[]) : undefined,
          }
        : undefined,
    };
  }

  if (looksLikeSettings(data)) {
    return { settings: data };
  }

  throw new Error("无法识别的配置文件。请选择本应用导出的 JSON，或 data 目录里的 config.json");
}

export function applyConfigBackup(raw: unknown): void {
  const parsed = parseConfigBackup(raw);
  const current = loadConfig();
  const incoming = parsed.settings;
  const patch: Partial<AppConfig> = {};

  for (const key of STRING_KEYS) {
    if (typeof incoming[key] !== "string") continue;
    const value = String(incoming[key]);
    if (SECRET_KEYS.has(key) && isMaskedSecret(value)) continue;
    patch[key] = value.trim();
    if (key === "hexoRoot" || key === "sshPrivateKeyPath") {
      patch[key] = patch[key]!.replace(/^["']|["']$/g, "");
    }
  }

  const rawPort = incoming.sshPort;
  if (rawPort !== undefined && rawPort !== null && rawPort !== "") {
    const port = Number(rawPort);
    if (Number.isFinite(port) && port > 0) patch.sshPort = Math.floor(port);
  }
  if (typeof incoming.autoUploadOnSave === "boolean") {
    patch.autoUploadOnSave = incoming.autoUploadOnSave;
  }
  if (typeof incoming.theme === "string") {
    patch.theme = normalizeTheme(incoming.theme);
  }
  if (typeof incoming.fontFamily === "string") {
    patch.fontFamily = normalizeFontFamily(incoming.fontFamily);
  }
  if (incoming.fontSize !== undefined && incoming.fontSize !== null && incoming.fontSize !== "") {
    patch.fontSize = normalizeFontSize(incoming.fontSize);
  }

  if (!Object.keys(patch).length && !parsed.templates?.items) {
    throw new Error("文件里没有可导入的设置");
  }

  saveConfig({ ...current, ...patch });

  if (parsed.templates?.items) {
    saveTemplates({
      defaultId: parsed.templates.defaultId,
      items: parsed.templates.items,
    });
  }
}
