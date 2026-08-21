import hljs from "highlight.js";

export function isMermaidLang(lang: string | undefined | null): boolean {
  const name = (lang || "").trim().toLowerCase();
  return name === "mermaid" || name === "mmd";
}

type CodeBlockMeta = {
  lang: string;
  hljsLang: string;
  title: string;
  url: string;
  linkText: string;
  firstLine: number;
  showLines: boolean | "auto";
  wrap: boolean;
  marks: Set<number>;
};

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
  sh: "bash",
  zsh: "bash",
  shell: "bash",
  console: "bash",
  bat: "dos",
  cmd: "dos",
  ps: "powershell",
  ps1: "powershell",
  py: "python",
  rb: "ruby",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  "c#": "csharp",
  "c++": "cpp",
  cc: "cpp",
  hh: "cpp",
  hpp: "cpp",
  h: "c",
  objc: "objectivec",
  mm: "objectivec",
  md: "markdown",
  html: "xml",
  htm: "xml",
  vue: "xml",
  svelte: "xml",
  astro: "xml",
  svg: "xml",
  jsonc: "json",
  json5: "json",
  docker: "dockerfile",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
  conf: "ini",
  toml: "ini",
};

const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  bash: "Shell",
  powershell: "PowerShell",
  yaml: "YAML",
  json: "JSON",
  xml: "HTML",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  markdown: "Markdown",
  rust: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  csharp: "C#",
  cpp: "C++",
  c: "C",
  objectivec: "Objective-C",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  dart: "Dart",
  sql: "SQL",
  graphql: "GraphQL",
  dockerfile: "Dockerfile",
  ini: "INI",
  diff: "Diff",
  plaintext: "Text",
  dos: "Batch",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function joinText(left: string, right: string): string {
  return left ? `${left} ${right}` : right;
}

function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) out.push(match[1] ?? match[2] ?? match[3] ?? "");
  return out;
}

function parseMarkSpec(value: string): number[] {
  const out: number[] = [];
  for (const part of value.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const range = piece.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      for (let n = start; n <= end && n - start < 400; n++) out.push(n);
      continue;
    }
    const n = Number(piece);
    if (Number.isFinite(n) && n > 0) out.push(Math.floor(n));
  }
  return out;
}

function resolveHljsLang(lang: string): string {
  const name = lang.trim().toLowerCase().replace(/^language-/, "");
  if (!name) return "";
  const aliased = LANG_ALIASES[name] || name;
  if (aliased === "plaintext") return "plaintext";
  if (hljs.getLanguage(aliased)) return aliased;
  if (hljs.getLanguage(name)) return name;
  return "";
}

function langLabel(lang: string, hljsLang: string): string {
  const key = (hljsLang || lang).trim().toLowerCase();
  if (!key) return "";
  if (LANG_LABELS[key]) return LANG_LABELS[key];
  if (LANG_ALIASES[key] && LANG_LABELS[LANG_ALIASES[key]]) return LANG_LABELS[LANG_ALIASES[key]];
  if (lang.toLowerCase() === "tsx") return "TSX";
  if (lang.toLowerCase() === "jsx") return "JSX";
  if (lang.toLowerCase() === "vue") return "Vue";
  return lang.trim().toUpperCase();
}

function emptyMeta(): CodeBlockMeta {
  return {
    lang: "",
    hljsLang: "",
    title: "",
    url: "",
    linkText: "",
    firstLine: 1,
    showLines: "auto",
    wrap: true,
    marks: new Set(),
  };
}

function applyOption(meta: CodeBlockMeta, key: string, value: string) {
  const name = key.toLowerCase().replace(/-/g, "_");
  if (name === "lang" || name === "language") meta.lang = value;
  else if (name === "title" || name === "filename" || name === "file" || name === "name") meta.title = value;
  else if (name === "url" || name === "href") meta.url = value;
  else if (name === "link" || name === "link_text" || name === "linktext") meta.linkText = value;
  else if (name === "first_line" || name === "firstline" || name === "start") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) meta.firstLine = Math.floor(n);
  } else if (name === "line_number" || name === "line_numbers" || name === "linenums") {
    meta.showLines = !/^(false|0|off|no)$/i.test(value);
  } else if (name === "wrap") {
    meta.wrap = !/^(false|0|off|no)$/i.test(value);
  } else if (name === "mark" || name === "hl" || name === "highlight") {
    for (const n of parseMarkSpec(value)) meta.marks.add(n);
  }
}

export function parseFenceInfo(info: string): CodeBlockMeta {
  const meta = emptyMeta();
  let raw = info.trim();
  if (!raw) return meta;

  raw = raw.replace(/\{([0-9,-\s]+)\}/g, (_all, inner: string) => {
    for (const n of parseMarkSpec(inner)) meta.marks.add(n);
    return " ";
  });

  raw = raw.replace(/\b([A-Za-z_][\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g, (_all, key: string, dq?: string, sq?: string, bare?: string) => {
    applyOption(meta, key, dq ?? sq ?? bare ?? "");
    return " ";
  });

  raw = raw.replace(/\b([A-Za-z_][\w-]*):(?:"([^"]*)"|'([^']*)'|(\S+))/g, (all, key: string, dq?: string, sq?: string, bare?: string) => {
    if (/^https?$/i.test(key)) return all;
    applyOption(meta, key, dq ?? sq ?? bare ?? "");
    return " ";
  });

  for (const token of tokenize(raw)) {
    if (!token) continue;
    if (/^https?:\/\//i.test(token)) {
      if (!meta.url) meta.url = token;
      else meta.linkText = joinText(meta.linkText, token);
      continue;
    }
    if (!meta.lang) {
      const named = token.match(/^([^:\\/]+):(.+)$/);
      if (named && !/^\d+$/.test(named[1])) {
        meta.lang = named[1];
        if (!meta.title) meta.title = named[2];
        continue;
      }
      meta.lang = token.replace(/^language-/i, "");
      continue;
    }
    if (meta.url) {
      meta.linkText = joinText(meta.linkText, token);
      continue;
    }
    meta.title = joinText(meta.title, token);
  }

  meta.hljsLang = resolveHljsLang(meta.lang);
  return meta;
}

function parseHexoCodeblockArgs(argString: string): CodeBlockMeta {
  const meta = emptyMeta();
  for (const token of tokenize(argString.trim())) {
    if (!token) continue;
    if (/^[A-Za-z_][\w-]*:/.test(token) && !/^[A-Za-z]+:\/\//.test(token)) {
      const idx = token.indexOf(":");
      applyOption(meta, token.slice(0, idx), token.slice(idx + 1));
      continue;
    }
    if (/^https?:\/\//i.test(token)) {
      meta.url = token;
      continue;
    }
    if (meta.url) {
      meta.linkText = joinText(meta.linkText, token);
      continue;
    }
    meta.title = joinText(meta.title, token);
  }
  meta.hljsLang = resolveHljsLang(meta.lang);
  return meta;
}

function quoteAttr(value: string): string {
  if (!/[\s"'=]/.test(value)) return value;
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/"/g, "")}"`;
}

export function hexoCodeblockToFence(argString: string, body: string): string {
  const meta = parseHexoCodeblockArgs(argString);
  const parts: string[] = [];
  if (meta.lang) parts.push(meta.lang);
  if (meta.title) parts.push(`title=${quoteAttr(meta.title)}`);
  if (meta.url) parts.push(`url=${quoteAttr(meta.url)}`);
  if (meta.linkText) parts.push(`link=${quoteAttr(meta.linkText)}`);
  const snippetMarks = [...meta.marks]
    .map((n) => n - meta.firstLine + 1)
    .filter((n) => n > 0);
  if (snippetMarks.length) parts.push(`mark=${snippetMarks.join(",")}`);
  if (meta.firstLine !== 1) parts.push(`first_line=${meta.firstLine}`);
  if (meta.showLines === false) parts.push("line_number=false");
  if (!meta.wrap) parts.push("wrap=false");
  const info = parts.join(" ");
  const code = body.replace(/^\n|\n$/g, "");
  return `\`\`\`${info}\n${code}\n\`\`\``;
}

export function fenceInfoFromToken(token: { lang?: string; raw?: string; codeBlockStyle?: string }): string {
  if (token.codeBlockStyle === "indented") return "";
  const first = (token.raw || "").split(/\r?\n/, 1)[0] || "";
  const info = first.replace(/^[ \t]*(`{3,}|~{3,})/, "").trim();
  return info || token.lang || "";
}

function highlightSource(code: string, meta: CodeBlockMeta): string {
  try {
    if (meta.hljsLang === "plaintext") return escapeHtml(code);
    if (meta.hljsLang && hljs.getLanguage(meta.hljsLang)) {
      return hljs.highlight(code, { language: meta.hljsLang, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function splitHighlightedLines(html: string): string[] {
  const lines = [""];
  const stack: { open: string; name: string }[] = [];
  const re = /(<[^>]+>)|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (match[1]) {
      const tag = match[1];
      const name = tag.match(/^<\/?([A-Za-z][\w:-]*)/)?.[1]?.toLowerCase() || "";
      if (/^<\//.test(tag)) {
        stack.pop();
        lines[lines.length - 1] += tag;
      } else if (/\/\s*>$/.test(tag) || name === "br") {
        lines[lines.length - 1] += tag;
      } else {
        stack.push({ open: tag, name });
        lines[lines.length - 1] += tag;
      }
      continue;
    }
    const parts = (match[2] || "").split("\n");
    for (let i = 0; i < parts.length; i++) {
      lines[lines.length - 1] += parts[i];
      if (i === parts.length - 1) continue;
      for (let s = stack.length - 1; s >= 0; s--) {
        lines[lines.length - 1] += `</${stack[s].name}>`;
      }
      lines.push(stack.map((item) => item.open).join(""));
    }
  }
  return lines;
}

function titleHtml(meta: CodeBlockMeta): string {
  const label = meta.linkText || meta.title || meta.url;
  if (!label) return "";
  if (meta.url) {
    return `<a class="preview-code-title" href="${escapeAttr(meta.url)}">${escapeHtml(label)}</a>`;
  }
  return `<span class="preview-code-title">${escapeHtml(label)}</span>`;
}

export function renderCodeBlock(code: string, info: string): string {
  const meta = parseFenceInfo(info);
  if (isMermaidLang(meta.lang)) {
    const lang = meta.lang.toLowerCase() === "mmd" ? "mmd" : "mermaid";
    return `<pre><code class="hljs language-${lang}">${escapeHtml(code)}</code></pre>\n`;
  }

  const source = code.replace(/\n$/, "");
  const lines = splitHighlightedLines(highlightSource(source, meta));
  const showLines = meta.showLines === true || (meta.showLines === "auto" && lines.length >= 2);
  const langClass = (meta.hljsLang || meta.lang || "plaintext").replace(/[^A-Za-z0-9_+-]/g, "") || "plaintext";
  const label = langLabel(meta.lang, meta.hljsLang);
  const lineHtml = lines
    .map((line, index) => {
      const snip = index + 1;
      const gutter = meta.firstLine + index;
      const mark = meta.marks.has(snip);
      const ln = showLines ? `<span class="code-ln" aria-hidden="true">${gutter}</span>` : "";
      return `<span class="code-line${mark ? " is-mark" : ""}">${ln}<span class="code-tx">${line}</span></span>`;
    })
    .join("");

  const classes = ["preview-code"];
  if (showLines) classes.push("has-lines");
  if (meta.wrap) classes.push("has-wrap");

  return `<div class="${classes.join(" ")}" data-lang="${escapeAttr(meta.lang || langClass)}">
<div class="preview-code-bar">
<div class="preview-code-meta">${label ? `<span class="preview-code-lang">${escapeHtml(label)}</span>` : ""}${titleHtml(meta)}</div>
<button type="button" class="preview-code-copy" aria-label="复制代码">复制</button>
</div>
<pre><code class="hljs language-${escapeAttr(langClass)}">${lineHtml}</code></pre>
</div>\n`;
}
