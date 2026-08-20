import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

function isMermaidLang(lang: string | undefined | null): boolean {
  const name = (lang || "").trim().toLowerCase();
  return name === "mermaid" || name === "mmd";
}

const marked = new Marked(
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (isMermaidLang(lang)) {
        return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

marked.setOptions({ gfm: true, breaks: true });

export function stripFrontMatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export type MdHeading = {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  line: number;
  from: number;
};

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[*_~]+/g, "")
    .trim();
}

export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "heading";
}

function parseHeadingText(raw: string): { text: string; idHint?: string } {
  let text = raw.trim();
  const custom = text.match(/^(.*?)\s*\{#([A-Za-z][\w:-]*)\}\s*$/);
  let idHint: string | undefined;
  if (custom) {
    text = custom[1].trim();
    idHint = custom[2];
  }
  return { text: stripInlineMarkdown(text) || "未命名标题", idHint };
}

function unwrapQuote(line: string): string {
  return line.replace(/^( {0,3}>[ \t]?)+/, "");
}

function parseAtx(line: string): { level: 1 | 2 | 3 | 4 | 5 | 6; text: string; idHint?: string } | null {
  const match = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|[ \t]*$)(.*)$/);
  if (!match) return null;
  const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
  const body = match[2].replace(/[ \t]+#*[ \t]*$/, "");
  return { level, ...parseHeadingText(body) };
}

export function extractHeadings(raw: string): MdHeading[] {
  const lines = raw.split("\n");
  const found: { level: 1 | 2 | 3 | 4 | 5 | 6; text: string; idHint?: string; line: number; from: number }[] = [];
  let from = 0;
  let fence: { ch: string; len: number } | null = null;
  let hexoCode = false;
  let hexoRaw = false;
  let skipNext = false;
  let inFrontMatter = /^---\s*$/.test((lines[0] || "").replace(/\r$/, ""));

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\r$/, "");
    const lineFrom = from;
    from += rawLine.length + (i < lines.length - 1 ? 1 : 0);

    if (inFrontMatter) {
      if (i > 0 && /^---\s*$/.test(line)) inFrontMatter = false;
      continue;
    }
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fenceMatch && !hexoCode && !hexoRaw) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { ch: marker[0], len: marker.length };
        continue;
      }
      if (marker[0] === fence.ch && marker.length >= fence.len && !fenceMatch[2].trim()) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;

    if (/^\{%\s*codeblock\b/.test(line)) {
      hexoCode = true;
      continue;
    }
    if (hexoCode) {
      if (/^\{%\s*endcodeblock\s*%\}/.test(line)) hexoCode = false;
      continue;
    }
    if (/^\{%\s*raw\s*%\}/.test(line)) {
      hexoRaw = true;
      continue;
    }
    if (hexoRaw) {
      if (/^\{%\s*endraw\s*%\}/.test(line)) hexoRaw = false;
      continue;
    }

    if (/^ {4,}|\t/.test(line) && !/^ {0,3}>/.test(line)) continue;

    const visible = unwrapQuote(line);
    if (/^ {4,}|\t/.test(visible)) continue;

    const atx = parseAtx(visible);
    if (atx) {
      found.push({ ...atx, line: i, from: lineFrom });
      continue;
    }

    const next = unwrapQuote(lines[i + 1]?.replace(/\r$/, "") ?? "");
    const setext = next.match(/^ {0,3}(=+|-+)[ \t]*$/);
    if (setext && visible.trim() && !/^ {4,}|\t/.test(visible)) {
      found.push({
        level: setext[1].startsWith("=") ? 1 : 2,
        ...parseHeadingText(visible),
        line: i,
        from: lineFrom,
      });
      skipNext = true;
    }
  }

  const seen = new Map<string, number>();
  return found.map((item) => {
    const base = item.idHint || slugifyHeading(item.text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return {
      id: count === 0 ? base : `${base}-${count}`,
      level: item.level,
      text: item.text,
      line: item.line,
      from: item.from,
    };
  });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function applyHeadingIds(html: string, headings: MdHeading[]): string {
  let index = 0;
  return html.replace(/<h([1-6])([^>]*)>/gi, (full, level: string, attrs: string) => {
    const heading = headings[index];
    index += 1;
    if (!heading) return full;
    const cleaned = attrs.replace(/\s(?:id|data-line)="[^"]*"/gi, "");
    return `<h${level}${cleaned} id="${escapeAttr(heading.id)}" data-line="${heading.line}">`;
  });
}

function frontMatterNewlines(raw: string): number {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) return 0;
  return (match[0].match(/\n/g) || []).length;
}

function extractFenceStartLines(body: string, lineBase: number): number[] {
  const lines = body.split("\n");
  const out: number[] = [];
  let fence: { ch: string; len: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fenceMatch) continue;
    const marker = fenceMatch[1];
    if (!fence) {
      fence = { ch: marker[0], len: marker.length };
      out.push(lineBase + i);
      continue;
    }
    if (marker[0] === fence.ch && marker.length >= fence.len && !fenceMatch[2].trim()) {
      fence = null;
    }
  }
  return out;
}

function applyPreDataLines(html: string, lines: number[]): string {
  let index = 0;
  return html.replace(/<pre\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\sdata-line=/i.test(full)) return full;
    const line = lines[index];
    index += 1;
    if (line == null) return full;
    return `<pre${attrs} data-line="${line}">`;
  });
}

let lineSource = "";
let lineBase = 0;

function lineIndex(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function offsetToLine(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (starts[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, high);
}

marked.use({
  hooks: {
    processAllTokens(tokens) {
      const starts = lineIndex(lineSource);
      let offset = 0;
      for (const token of tokens as { raw?: string; _sourceLine?: number }[]) {
        token._sourceLine = lineBase + offsetToLine(starts, offset);
        offset += token.raw?.length ?? 0;
      }
      return tokens;
    },
  },
  renderer: {
    paragraph(this: { parser: { parseInline: (tokens: unknown) => string } }, token) {
      const line = (token as { _sourceLine?: number })._sourceLine;
      const text = this.parser.parseInline((token as { tokens: unknown }).tokens);
      if (line == null) return `<p>${text}</p>\n`;
      return `<p data-line="${line}">${text}</p>\n`;
    },
    hr(this: unknown, token) {
      const line = (token as { _sourceLine?: number })._sourceLine;
      if (line == null) return "<hr>\n";
      return `<hr data-line="${line}">\n`;
    },
  },
});

export function parseTitle(raw: string): string {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return "";
  const title = m[1].match(/^title:\s*(.*)$/m);
  return title ? title[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

function preprocessHexo(md: string): string {
  return md
    .replace(/\{%\s*raw\s*%\}([\s\S]*?)\{%\s*endraw\s*%\}/g, "$1")
    .replace(/\{%\s*asset_img\s+(\S+)(?:\s+(.+?))?\s*%\}/g, (_all, file: string, title?: string) => {
      return `![${(title || file).trim()}](${file})`;
    })
    .replace(
      /\{%\s*img\s+(?:[a-zA-Z][\w-]*\s+)?(\S+)(?:\s+\d+)?(?:\s+\d+)?(?:\s+(.+?))?\s*%\}/g,
      (_all, url: string, title?: string) => `![${(title || "").trim()}](${url})`,
    )
    .replace(
      /\{%\s*blockquote(?:\s+(.+?))?\s*%\}([\s\S]*?)\{%\s*endblockquote\s*%\}/g,
      (_all, author: string | undefined, body: string) => {
        const quote = body.trim().replace(/\n/g, "\n> ");
        return `> ${quote}${author ? `\n>\n> — ${author.trim()}` : ""}`;
      },
    )
    .replace(
      /\{%\s*codeblock(?:\s+(?:lang:)?(\S+))?[^\n%]*%\}([\s\S]*?)\{%\s*endcodeblock\s*%\}/g,
      (_all, lang: string | undefined, body: string) => {
        return `\`\`\`${lang || ""}\n${body.replace(/^\n|\n$/g, "")}\n\`\`\``;
      },
    )
    .replace(/\{%\s*mermaid\b[^%]*%\}([\s\S]*?)\{%\s*endmermaid\s*%\}/g, (_all, body: string) => {
      return `\n\`\`\`mermaid\n${String(body).trim()}\n\`\`\`\n`;
    });
}

function rewriteLocalImages(html: string, postPath: string | null, origin: "local" | "remote" = "local"): string {
  if (!postPath) return html;
  const assetDir = postPath.replace(/\.md$/i, "/");
  const scheme = origin === "remote" ? "remote" : "local";
  return html.replace(/<img\s([^>]*?)src="([^"]+)"/gi, (full, pre: string, src: string) => {
    if (/^(https?:|data:|blob:|\/\/|hexomd:)/i.test(src)) return full;
    const rel = src.replace(/^\.\//, "");
    const mediaPath = rel.startsWith("source/") ? rel : `${assetDir}${rel}`;
    const encoded = mediaPath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `<img ${pre}src="hexomd://${scheme}/${encoded}"`;
  });
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attrValue(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decodeAttr(match[1]).trim() : "";
}

function applyImageCaptions(html: string): string {
  return html.replace(/<p(\b[^>]*)>\s*(<img\b[^>]*>)\s*<\/p>/gi, (_all, attrs: string, img: string) => {
    const caption = attrValue(img, "title") || attrValue(img, "alt");
    if (!caption) return `<p${attrs}>${img}</p>`;
    return `<figure class="preview-figure"${attrs}>${img}<figcaption>${escapeAttr(caption)}</figcaption></figure>`;
  });
}

function promoteMermaidBlocks(html: string): string {
  return html.replace(
    /<pre(\b[^>]*)>\s*<code\b([^>]*\blanguage-(?:mermaid|mmd)\b[^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_all, preAttrs: string, _codeAttrs: string, body: string) => {
      return `<div class="preview-mermaid"${preAttrs}><pre class="mermaid-src">${body}</pre></div>`;
    },
  );
}

export function renderMarkdown(
  raw: string,
  postPath: string | null,
  origin: "local" | "remote" = "local",
): string {
  const headings = extractHeadings(raw);
  const body = preprocessHexo(stripFrontMatter(raw));
  lineSource = body;
  lineBase = frontMatterNewlines(raw);
  const html = promoteMermaidBlocks(
    applyImageCaptions(
      rewriteLocalImages(
        applyPreDataLines(
          applyHeadingIds(marked.parse(body, { async: false }) as string, headings),
          extractFenceStartLines(body, lineBase),
        ),
        postPath,
        origin,
      ),
    ),
  );
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["figure", "figcaption"],
    ADD_ATTR: ["target", "id"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|hexomd|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

export function countWords(raw: string): { chars: number; words: number } {
  const body = stripFrontMatter(raw).trim();
  const chars = body.replace(/\s/g, "").length;
  const cn = (body.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (body.replace(/[\u4e00-\u9fff]/g, "").match(/[A-Za-z0-9]+/g) || []).length;
  return { chars, words: cn + en };
}

export function slugifyFilename(title: string): string {
  const slug = title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${(slug.slice(0, 80) || "untitled")}.md`;
}

export function imageFileName(file: File): string {
  if (file.name && file.name !== "image.png") return file.name;
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `paste-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}.${ext}`;
}
