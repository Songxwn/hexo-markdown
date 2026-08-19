import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import matter from "gray-matter";
import type { PostFolder, PostSummary } from "./types";

const FOLDER_MAP: Record<PostFolder, string> = {
  posts: "source/_posts",
  drafts: "source/_drafts",
};

export function hexoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function validateHexoRoot(hexoRoot: string): { ok: boolean; hasConfig: boolean; error?: string } {
  if (!hexoRoot.trim()) return { ok: false, hasConfig: false, error: "未设置 Hexo 根目录" };
  const root = resolve(hexoRoot);
  if (!existsSync(root)) return { ok: false, hasConfig: false, error: "目录不存在" };
  const st = statSync(root);
  if (!st.isDirectory()) return { ok: false, hasConfig: false, error: "路径不是目录" };
  const hasConfig = existsSync(join(root, "_config.yml")) || existsSync(join(root, "_config.yaml"));
  return { ok: true, hasConfig };
}

function assertInside(root: string, abs: string): void {
  const rel = relative(resolve(root), abs);
  if (!rel || rel.startsWith("..") || rel.split(sep).includes("..")) {
    throw new Error("路径越界");
  }
}

export function resolveRel(hexoRoot: string, relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.includes("\0")) {
    throw new Error("非法路径");
  }
  if (!normalized.startsWith("source/_posts/") && !normalized.startsWith("source/_drafts/") && normalized !== "source/_posts" && normalized !== "source/_drafts") {
    throw new Error("只能访问 source/_posts 或 source/_drafts");
  }
  const abs = resolve(hexoRoot, ...normalized.split("/"));
  assertInside(hexoRoot, abs);
  return abs;
}

function walkMarkdown(dir: string, root: string, folder: PostFolder, out: PostSummary[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(abs, root, folder, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    const rel = relative(root, abs).replace(/\\/g, "/");
    let title = entry.name.replace(/\.md$/i, "");
    let date = "";
    try {
      const raw = readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
      const parsed = matter(raw);
      if (typeof parsed.data.title === "string" && parsed.data.title.trim()) {
        title = parsed.data.title;
      }
      if (parsed.data.date) date = String(parsed.data.date);
    } catch {
      /* ignore broken front matter */
    }
    const st = statSync(abs);
    out.push({
      path: rel,
      name: entry.name,
      folder,
      title,
      date,
      mtime: st.mtimeMs,
    });
  }
}

export function listPosts(hexoRoot: string): PostSummary[] {
  const root = resolve(hexoRoot);
  const items: PostSummary[] = [];
  walkMarkdown(join(root, FOLDER_MAP.posts), root, "posts", items);
  walkMarkdown(join(root, FOLDER_MAP.drafts), root, "drafts", items);
  items.sort((a, b) => b.mtime - a.mtime);
  return items;
}

export function readPost(hexoRoot: string, relPath: string): { path: string; content: string } {
  const abs = resolveRel(hexoRoot, relPath);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new Error("文章不存在");
  }
  return {
    path: relPath.replace(/\\/g, "/"),
    content: readFileSync(abs, "utf8").replace(/^\uFEFF/, ""),
  };
}

export function writePost(hexoRoot: string, relPath: string, content: string): { path: string } {
  const abs = resolveRel(hexoRoot, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return { path: relPath.replace(/\\/g, "/") };
}

export function deletePost(hexoRoot: string, relPath: string): void {
  const abs = resolveRel(hexoRoot, relPath);
  if (existsSync(abs)) unlinkSync(abs);
}

function slugify(title: string): string {
  const slug = title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.slice(0, 80) || "untitled";
}

export function createPost(
  hexoRoot: string,
  title: string,
  folder: PostFolder,
): { path: string; content: string } {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const filename = `${stamp}-${slugify(title)}.md`;
  const relPath = `${FOLDER_MAP[folder]}/${filename}`;
  const abs = resolveRel(hexoRoot, relPath);
  if (existsSync(abs)) {
    throw new Error("同名文章已存在");
  }
  const content = `---
title: ${JSON.stringify(title.replace(/\r?\n/g, " ").trim())}
date: ${hexoDate(now)}
tags:
categories:
---

`;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return { path: relPath, content };
}

export function saveLocalAsset(
  hexoRoot: string,
  postPath: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
): { url: string; key: string } {
  if (!postPath.endsWith(".md")) throw new Error("请先打开一篇文章");
  const postAbs = resolveRel(hexoRoot, postPath);
  const assetDir = postAbs.replace(/\.md$/i, "");
  mkdirSync(assetDir, { recursive: true });
  const ext =
    {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "image/bmp": ".bmp",
      "image/avif": ".avif",
    }[file.mimetype] || extname(file.originalname) || ".png";
  const base =
    file.originalname
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "")
      .replace(/[^\w.\u4e00-\u9fff-]+/g, "-") || "image";
  const name = `${Date.now()}-${base}${ext}`;
  const abs = join(assetDir, name);
  assertInside(hexoRoot, abs);
  writeFileSync(abs, file.buffer);
  return { url: name, key: relative(resolve(hexoRoot), abs).replace(/\\/g, "/") };
}

export function resolveMedia(hexoRoot: string, relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || !normalized.startsWith("source/")) {
    throw new Error("非法路径");
  }
  const abs = resolve(hexoRoot, ...normalized.split("/"));
  assertInside(hexoRoot, abs);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new Error("文件不存在");
  }
  return abs;
}
