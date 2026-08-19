import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./types";

let dataDir = join(process.cwd(), "data");

function configPath(): string {
  return join(dataDir, "config.json");
}

function loadDotEnvFile(envPath: string): void {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function initConfig(options: { dataDir: string; envFiles?: string[] }): void {
  dataDir = options.dataDir;
  for (const file of options.envFiles || []) {
    loadDotEnvFile(file);
  }
}

export function defaultConfig(): AppConfig {
  return {
    hexoRoot: process.env.HEXO_ROOT?.trim() || "",
    r2AccountId: process.env.R2_ACCOUNT_ID?.trim() || "",
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() || "",
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() || "",
    r2Bucket: process.env.R2_BUCKET?.trim() || "",
    r2PublicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
    r2KeyPrefix: process.env.R2_KEY_PREFIX?.trim() || "hexo",
    sshHost: process.env.SSH_HOST?.trim() || "",
    sshPort: Number(process.env.SSH_PORT || 22) || 22,
    sshUser: process.env.SSH_USER?.trim() || "",
    sshPassword: process.env.SSH_PASSWORD?.trim() || "",
    sshPrivateKeyPath: process.env.SSH_PRIVATE_KEY?.trim() || "",
    sshPassphrase: process.env.SSH_PASSPHRASE?.trim() || "",
    remoteHexoRoot: (process.env.REMOTE_HEXO_ROOT || "").replace(/\\/g, "/").replace(/\/+$/, ""),
    sshInitCmd:
      process.env.SSH_INIT_CMD?.trim() ||
      "source ~/.nvm/nvm.sh 2>/dev/null || true; source ~/.bashrc 2>/dev/null || true",
    sshGenerateCmd: process.env.SSH_GENERATE_CMD?.trim() || "npx hexo generate",
    sshDeployCmd: process.env.SSH_DEPLOY_CMD?.trim() || "npx hexo deploy",
    autoUploadOnSave: process.env.SSH_AUTO_UPLOAD === "1",
  };
}

function readFileConfig(): Partial<AppConfig> {
  const file = configPath();
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Partial<AppConfig>;
  } catch {
    return {};
  }
}

function normalize(cfg: AppConfig): AppConfig {
  const port = Number(cfg.sshPort);
  cfg.sshPort = Number.isFinite(port) && port > 0 ? Math.floor(port) : 22;
  cfg.autoUploadOnSave = Boolean(cfg.autoUploadOnSave);
  cfg.remoteHexoRoot = (cfg.remoteHexoRoot || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (cfg.r2PublicUrl) cfg.r2PublicUrl = cfg.r2PublicUrl.replace(/\/+$/, "");
  return cfg;
}

export function loadConfig(): AppConfig {
  return normalize({ ...defaultConfig(), ...readFileConfig() });
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  const next = normalize({ ...loadConfig(), ...patch });
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(configPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function isR2Configured(cfg: AppConfig): boolean {
  return Boolean(
    cfg.r2AccountId &&
      cfg.r2AccessKeyId &&
      cfg.r2SecretAccessKey &&
      cfg.r2Bucket &&
      cfg.r2PublicUrl,
  );
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}
