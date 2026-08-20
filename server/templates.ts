import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "./config";
import type { PostTemplate, TemplateSet } from "./types";

export const DEFAULT_TEMPLATE_ID = "default";

export const DEFAULT_TEMPLATE_BODY = `---
title: {{ title }}
date: {{ date }}
tags:
categories:
---

`;

function templatesPath(): string {
  return join(getDataDir(), "templates.json");
}

export function defaultTemplateSet(): TemplateSet {
  return {
    defaultId: DEFAULT_TEMPLATE_ID,
    items: [
      {
        id: DEFAULT_TEMPLATE_ID,
        name: "默认文章",
        body: DEFAULT_TEMPLATE_BODY,
      },
    ],
    scaffolds: [],
  };
}

function newId(): string {
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanItem(raw: Partial<PostTemplate> | null | undefined): PostTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim() || "未命名模板";
  const body = typeof raw.body === "string" ? raw.body : DEFAULT_TEMPLATE_BODY;
  const id = String(raw.id || "").trim() || newId();
  if (id.startsWith("scaffold:")) return null;
  return { id, name, body };
}

export function normalizeTemplateSet(input: Partial<TemplateSet> | null | undefined): TemplateSet {
  const fallback = defaultTemplateSet();
  const items = (input?.items || []).map(cleanItem).filter((item): item is PostTemplate => Boolean(item));
  const nextItems = items.length ? items : fallback.items;
  const defaultId =
    nextItems.some((item) => item.id === input?.defaultId) && input?.defaultId
      ? input.defaultId
      : nextItems[0].id;
  return { defaultId, items: nextItems, scaffolds: [] };
}

function readStoredTemplates(): TemplateSet {
  const file = templatesPath();
  if (!existsSync(file)) return defaultTemplateSet();
  try {
    return normalizeTemplateSet(JSON.parse(readFileSync(file, "utf8")) as Partial<TemplateSet>);
  } catch {
    return defaultTemplateSet();
  }
}

function scaffoldFile(hexoRoot: string, name: string): PostTemplate | null {
  const abs = join(hexoRoot, "scaffolds", `${name}.md`);
  if (!existsSync(abs)) return null;
  try {
    const body = readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
    if (!body.trim()) return null;
    return {
      id: `scaffold:${name}`,
      name: name === "draft" ? "Hexo 草稿脚手架" : "Hexo 文章脚手架",
      body,
      readonly: true,
    };
  } catch {
    return null;
  }
}

export function listScaffolds(hexoRoot: string): PostTemplate[] {
  if (!hexoRoot.trim()) return [];
  const out: PostTemplate[] = [];
  const post = scaffoldFile(hexoRoot, "post");
  const draft = scaffoldFile(hexoRoot, "draft");
  if (post) out.push(post);
  if (draft) out.push(draft);
  return out;
}

export function listTemplates(hexoRoot = ""): TemplateSet {
  const stored = readStoredTemplates();
  return {
    ...stored,
    scaffolds: listScaffolds(hexoRoot),
  };
}

export function saveTemplates(patch: Partial<TemplateSet>): TemplateSet {
  const next = normalizeTemplateSet(patch);
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    templatesPath(),
    JSON.stringify({ defaultId: next.defaultId, items: next.items }, null, 2),
    "utf8",
  );
  return next;
}

export function resolveTemplateBody(hexoRoot: string, templateId?: string | null): string {
  const set = listTemplates(hexoRoot);
  const id = templateId || set.defaultId;
  const all = [...set.items, ...set.scaffolds];
  const found = all.find((item) => item.id === id);
  if (found?.body.trim()) return found.body;
  const fallback = set.items.find((item) => item.id === set.defaultId) || set.items[0];
  return fallback?.body || DEFAULT_TEMPLATE_BODY;
}

function yamlScalar(value: string): string {
  return JSON.stringify(value.replace(/\r?\n/g, " ").trim());
}

export function applyPostTemplate(
  raw: string,
  vars: { title: string; date: string; slug: string; filename: string },
): string {
  let text = (raw || "").replace(/^\uFEFF/, "");
  if (!text.trim()) text = DEFAULT_TEMPLATE_BODY;

  text = text
    .replace(/\{\{\s*title\s*\}\}/gi, () => vars.title)
    .replace(/\{\{\s*date\s*\}\}/gi, () => vars.date)
    .replace(/\{\{\s*filename\s*\}\}/gi, () => vars.filename)
    .replace(/\{\{\s*slug\s*\}\}/gi, () => vars.slug);

  if (!/^---[ \t]*\r?\n/.test(text)) {
    return `---\ntitle: ${yamlScalar(vars.title)}\ndate: ${vars.date}\n---\n\n${text.replace(/^\r?\n/, "")}`;
  }

  const fm = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---([ \t]*\r?\n)?/);
  if (!fm) {
    return `---\ntitle: ${yamlScalar(vars.title)}\ndate: ${vars.date}\n---\n\n${text}`;
  }

  let block = fm[1];
  if (/^title\s*:/m.test(block)) {
    block = block.replace(/^title\s*:.*$/m, `title: ${yamlScalar(vars.title)}`);
  } else {
    block = `title: ${yamlScalar(vars.title)}\n${block}`;
  }
  if (/^date\s*:/m.test(block)) {
    block = block.replace(/^date\s*:.*$/m, `date: ${vars.date}`);
  } else {
    block = `date: ${vars.date}\n${block}`;
  }

  return `---\n${block}\n---${text.slice(fm[0].length)}`;
}
