import { extname } from "node:path";
import { isR2Configured, loadConfig, maskSecret, saveConfig } from "./config";
import {
  createPost,
  deletePost,
  listPosts,
  readPost,
  resolveMedia,
  saveLocalAsset,
  validateHexoRoot,
  writePost,
} from "./posts";
import { uploadToR2 } from "./r2";
import { isSshConfigured } from "./ssh";
import type { AppConfig, PostFolder } from "./types";

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
    r2Configured: isR2Configured(cfg),
    sshConfigured: isSshConfigured(),
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
  ];
  const secretKeys = new Set<keyof AppConfig>(["r2SecretAccessKey", "sshPassword", "sshPassphrase"]);
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
  saveConfig({ ...current, ...patch });
  return publicConfig();
}

export function getPosts() {
  return listPosts(requireHexo().hexoRoot);
}

export function getPost(rel: string) {
  if (!rel) throw new Error("缺少 path");
  return readPost(requireHexo().hexoRoot, rel);
}

export function putPost(rel: string, content: string) {
  if (!rel) throw new Error("缺少 path");
  return writePost(requireHexo().hexoRoot, rel, content);
}

export function newPost(title: string, folder: PostFolder) {
  return createPost(requireHexo().hexoRoot, title.trim() || "未命名", folder === "drafts" ? "drafts" : "posts");
}

export function removePost(rel: string) {
  if (!rel) throw new Error("缺少 path");
  deletePost(requireHexo().hexoRoot, rel);
}

export function mediaAbsolutePath(rel: string) {
  if (!rel) throw new Error("缺少 path");
  return resolveMedia(requireHexo().hexoRoot, rel);
}

export async function uploadImage(file: UploadInput, postPath: string | null) {
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
  const hexo = validateHexoRoot(cfg.hexoRoot);
  if (!hexo.ok || !postPath) {
    throw new Error(
      "尚未配置 Cloudflare R2。请在设置中填写 R2 信息，或先打开一篇文章以保存到本地资源目录。",
    );
  }
  const result = saveLocalAsset(cfg.hexoRoot, postPath, file);
  return { ...result, storage: "local" as const };
}
