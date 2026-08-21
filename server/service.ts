import { extname } from "node:path";
import { isR2Configured, loadConfig, maskSecret, saveConfig } from "./config";
import {
  createPost,
  deletePost,
  listPosts,
  readPost,
  renamePost as renamePostFile,
  movePost as movePostFile,
  resolveMedia,
  saveLocalAsset,
  validateHexoRoot,
  writePost,
} from "./posts";
import { uploadToR2 } from "./r2";
import {
  isSshConfigured,
  sshCreateRemotePost,
  sshDeleteRemotePost,
  sshListRemotePosts,
  sshReadRemoteMedia,
  sshReadRemotePost,
  sshRenameRemotePost,
  sshSaveRemoteAsset,
  sshWriteRemotePost,
} from "./ssh";
import { applyConfigBackup, buildConfigBackup } from "./backup";
import { listTemplates, saveTemplates } from "./templates";
import { isLlmConfigured } from "./llm";
import { normalizeTheme } from "./theme";
import { normalizeFontFamily, normalizeFontSize } from "./typography";
import type { AppConfig, PostFolder, PostOrigin, TemplateSet } from "./types";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/avif",
]);

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"];

export type UploadInput = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export function publicConfig() {
  const cfg = loadConfig();
  const hexo = validateHexoRoot(cfg.hexoRoot);
  return {
    hexoRoot: cfg.hexoRoot,
    r2AccountId: cfg.r2AccountId,
    r2AccessKeyId: cfg.r2AccessKeyId,
    r2SecretAccessKey: maskSecret(cfg.r2SecretAccessKey),
    r2Bucket: cfg.r2Bucket,
    r2PublicUrl: cfg.r2PublicUrl,
    r2KeyPrefix: cfg.r2KeyPrefix || "hexo",
    sshHost: cfg.sshHost,
    sshPort: cfg.sshPort,
    sshUser: cfg.sshUser,
    sshPassword: maskSecret(cfg.sshPassword),
    sshPrivateKeyPath: cfg.sshPrivateKeyPath,
    sshPassphrase: maskSecret(cfg.sshPassphrase),
    remoteHexoRoot: cfg.remoteHexoRoot,
    sshInitCmd: cfg.sshInitCmd,
    sshGenerateCmd: cfg.sshGenerateCmd,
    sshDeployCmd: cfg.sshDeployCmd,
    autoUploadOnSave: cfg.autoUploadOnSave,
    theme: cfg.theme,
    fontFamily: cfg.fontFamily,
    fontSize: cfg.fontSize,
    llmBaseUrl: cfg.llmBaseUrl,
    llmApiKey: maskSecret(cfg.llmApiKey),
    llmModel: cfg.llmModel,
    r2Configured: isR2Configured(cfg),
    sshConfigured: isSshConfigured(),
    llmConfigured: isLlmConfigured(cfg),
    hexoValid: hexo.ok,
    hexoHasConfig: hexo.hasConfig,
  };
}

function requireHexo(): AppConfig {
  const cfg = loadConfig();
  const hexo = validateHexoRoot(cfg.hexoRoot);
  if (!hexo.ok) {
    throw new Error(hexo.error || "Hexo 根目录无效");
  }
  return cfg;
}

export function updateSettings(body: Partial<AppConfig> & Record<string, unknown>) {
  const current = loadConfig();
  const patch: Partial<AppConfig> = {};
  const stringKeys: (keyof AppConfig)[] = [
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
  const secretKeys = new Set<keyof AppConfig>(["r2SecretAccessKey", "sshPassword", "sshPassphrase", "llmApiKey"]);
  for (const key of stringKeys) {
    if (typeof body[key] !== "string") continue;
    if (secretKeys.has(key) && (body[key] === "" || String(body[key]).includes("••••"))) {
      continue;
    }
    patch[key] = String(body[key]).trim();
    if (key === "hexoRoot" || key === "sshPrivateKeyPath") {
      patch[key] = patch[key]!.replace(/^["']|["']$/g, "");
    }
  }
  const rawPort = body.sshPort as unknown;
  if (rawPort !== undefined && rawPort !== null && rawPort !== "") {
    const port = Number(rawPort);
    if (Number.isFinite(port) && port > 0) patch.sshPort = Math.floor(port);
  }
  if (typeof body.autoUploadOnSave === "boolean") {
    patch.autoUploadOnSave = body.autoUploadOnSave;
  }
  if (typeof body.theme === "string") {
    patch.theme = normalizeTheme(body.theme);
  }
  if (typeof body.fontFamily === "string") {
    patch.fontFamily = normalizeFontFamily(body.fontFamily);
  }
  if (body.fontSize !== undefined && body.fontSize !== null && body.fontSize !== "") {
    patch.fontSize = normalizeFontSize(body.fontSize);
  }
  saveConfig({ ...current, ...patch });
  return publicConfig();
}

export function exportSettingsBackup() {
  return buildConfigBackup();
}

export function importSettingsBackup(raw: unknown) {
  applyConfigBackup(raw);
  const cfg = loadConfig();
  return {
    settings: publicConfig(),
    templates: listTemplates(cfg.hexoRoot),
  };
}

function isRemote(origin?: PostOrigin | string | null): boolean {
  return origin === "remote";
}

export function getPosts() {
  return listPosts(requireHexo().hexoRoot);
}

export function getRemotePosts() {
  return sshListRemotePosts();
}

export function getPost(rel: string, origin?: PostOrigin | null) {
  if (!rel) throw new Error("缺少 path");
  if (isRemote(origin)) return sshReadRemotePost(rel);
  return readPost(requireHexo().hexoRoot, rel);
}

export function putPost(rel: string, content: string, origin?: PostOrigin | null) {
  if (!rel) throw new Error("缺少 path");
  if (isRemote(origin)) return sshWriteRemotePost(rel, content);
  return writePost(requireHexo().hexoRoot, rel, content);
}

export function getTemplates() {
  return listTemplates(loadConfig().hexoRoot);
}

export function updateTemplates(body: Partial<TemplateSet> & Record<string, unknown>) {
  saveTemplates(body);
  return listTemplates(loadConfig().hexoRoot);
}

export function newPost(
  title: string,
  folder: PostFolder,
  templateId?: string | null,
  origin?: PostOrigin | null,
) {
  if (isRemote(origin)) {
    return sshCreateRemotePost(title.trim() || "未命名", templateId);
  }
  return createPost(
    requireHexo().hexoRoot,
    title.trim() || "未命名",
    folder === "drafts" ? "drafts" : "posts",
    templateId,
  );
}

export function removePost(rel: string, origin?: PostOrigin | null) {
  if (!rel) throw new Error("缺少 path");
  if (isRemote(origin)) return sshDeleteRemotePost(rel);
  deletePost(requireHexo().hexoRoot, rel);
}

export function renamePost(rel: string, nextName: string, origin?: PostOrigin | null) {
  if (!rel) throw new Error("缺少 path");
  if (isRemote(origin)) return sshRenameRemotePost(rel, nextName);
  return renamePostFile(requireHexo().hexoRoot, rel, nextName);
}

export function movePost(rel: string, toFolder: PostFolder, origin?: PostOrigin | null) {
  if (!rel) throw new Error("缺少 path");
  if (isRemote(origin)) throw new Error("远程文章已在已发布目录，无需再移动");
  return movePostFile(requireHexo().hexoRoot, rel, toFolder === "drafts" ? "drafts" : "posts");
}

export function mediaAbsolutePath(rel: string) {
  if (!rel) throw new Error("缺少 path");
  return resolveMedia(requireHexo().hexoRoot, rel);
}

export function remoteMediaBytes(rel: string) {
  if (!rel) throw new Error("缺少 path");
  return sshReadRemoteMedia(rel);
}

export async function uploadImage(
  file: UploadInput,
  postPath: string | null,
  origin?: PostOrigin | null,
) {
  const ext = extname(file.originalname).toLowerCase();
  if (!IMAGE_TYPES.has(file.mimetype) && !IMAGE_EXTS.includes(ext)) {
    throw new Error("仅支持图片文件");
  }
  if (file.buffer.length > 10 * 1024 * 1024) {
    throw new Error("图片不能超过 10MB");
  }
  const cfg = loadConfig();
  if (isR2Configured(cfg)) {
    const result = await uploadToR2(cfg, file);
    return { ...result, storage: "r2" as const };
  }
  if (isRemote(origin)) {
    if (!postPath) throw new Error("请先打开一篇远程文章");
    const result = await sshSaveRemoteAsset(postPath, file);
    return { ...result, storage: "remote" as const };
  }
  const hexo = validateHexoRoot(cfg.hexoRoot);
  if (!hexo.ok || !postPath) {
    throw new Error(
      "尚未配置 Cloudflare R2。请在设置中填写 R2 信息，或先打开一篇文章以保存到本地资源目录。",
    );
  }
  const result = saveLocalAsset(cfg.hexoRoot, postPath, file);
  return { ...result, storage: "local" as const };
}
