import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

const marked = new Marked(
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, lang) {
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
    );
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

export function renderMarkdown(
  raw: string,
  postPath: string | null,
  origin: "local" | "remote" = "local",
): string {
  const body = preprocessHexo(stripFrontMatter(raw));
  const html = marked.parse(body, { async: false }) as string;
  return DOMPurify.sanitize(rewriteLocalImages(html, postPath, origin), {
    ADD_ATTR: ["target"],
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
