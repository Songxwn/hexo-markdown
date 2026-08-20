import { loadConfig } from "./config";
import type { AppConfig } from "./types";

export type LlmChatInput = {
  mode?: string;
  instruction?: string;
  selection?: string;
  article?: string;
};

function resolveChatUrl(base: string): string {
  const raw = base.trim();
  if (!raw) throw new Error("未填写 LLM 接口地址");
  if (/\/chat\/completions(\?|$)/i.test(raw)) return raw;
  return `${raw.replace(/\/+$/, "")}/chat/completions`;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[已截断]`;
}

function modeInstruction(mode: string, custom?: string): string {
  const extra = (custom || "").trim();
  let base = "";
  switch (mode) {
    case "continue":
      base = "请接着往下写，保持语气、人称和 Markdown 结构一致。不要重复已有内容。";
      break;
    case "polish":
      base = "请润色文字：更通顺、准确，保留原意、信息量和 Markdown / YAML 结构。不要扩写成另一篇。";
      break;
    case "expand":
      base = "请扩写，补充细节与过渡，仍保持原意和 Markdown 结构。";
      break;
    case "shorten":
      base = "请压缩篇幅，删掉空话，保留要点和 Markdown 结构。";
      break;
    case "zh":
      base = "请译为通顺的简体中文 Markdown，保留代码、链接和 front-matter。";
      break;
    case "en":
      base = "Translate into natural English Markdown. Keep code, links, and YAML front-matter.";
      break;
    case "custom":
      return extra || "请按用户要求改写。";
    default:
      return extra || "请协助改写这段 Markdown。";
  }
  return extra ? `${base}\n\n补充要求：${extra}` : base;
}

function buildMessages(input: LlmChatInput): { role: "system" | "user"; content: string }[] {
  const selection = String(input.selection || "").trim();
  const article = clip(String(input.article || "").trim(), 18000);
  const focus = clip(selection || article, 12000);
  if (!focus) throw new Error("没有可处理的内容，请先打开文章或选中一段文字");
  if (input.mode === "custom" && !String(input.instruction || "").trim()) {
    throw new Error("请输入自定义指令");
  }
  const task = modeInstruction(String(input.mode || "custom"), input.instruction);
  const scope = selection
    ? `下面是当前文章（供上下文，不要原样复述全文）：\n\n${article || "（空）"}\n\n请只处理这段选中的内容：\n\n${clip(selection, 12000)}`
    : `下面是当前文章：\n\n${focus}`;
  return [
    {
      role: "system",
      content:
        "你是 Hexo 博客的 Markdown 写作助手。只输出可以直接贴进编辑器的 Markdown，不要解释过程，不要用总的代码围栏包住全文。保留 YAML front-matter、链接和已有结构。不要编造文中没有的出处。",
    },
    { role: "user", content: `${task}\n\n${scope}` },
  ];
}

export function isLlmConfigured(cfg: AppConfig = loadConfig()): boolean {
  return Boolean(cfg.llmBaseUrl?.trim() && cfg.llmModel?.trim());
}

function extractText(piece: unknown): string {
  if (typeof piece === "string") return piece;
  if (!Array.isArray(piece)) return "";
  return piece
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : "";
      }
      return "";
    })
    .join("");
}

function extractDelta(json: Record<string, unknown>): string {
  const err = json.error as { message?: unknown } | undefined;
  if (typeof err?.message === "string" && err.message.trim()) {
    throw new Error(err.message.trim());
  }
  const choices = json.choices as
    | { delta?: { content?: unknown }; message?: { content?: unknown } }[]
    | undefined;
  const piece = choices?.[0]?.delta?.content ?? choices?.[0]?.message?.content;
  return extractText(piece);
}

async function readHttpError(res: Response): Promise<string> {
  try {
    const err = (await res.json()) as { error?: { message?: string }; message?: string };
    return (err.error?.message || err.message || "").trim();
  } catch {
    return (await res.text().catch(() => "")).trim();
  }
}

function yieldSseLine(line: string): string | null | "done" {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return "done";
  if (!data) return null;
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  return extractDelta(json);
}

async function* readSse(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (value) buf += decoder.decode(value, { stream: !done });
      if (done) buf += decoder.decode();
      const lines = buf.split(/\r?\n/);
      buf = done ? "" : lines.pop() || "";
      for (const line of lines) {
        const piece = yieldSseLine(line);
        if (piece === "done") return;
        if (piece) yield piece;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

async function* emitResponse(res: Response, signal: AbortSignal): AsyncGenerator<string> {
  const ctype = res.headers.get("content-type") || "";
  if (res.body && /event-stream|octet-stream|text\/plain/i.test(ctype)) {
    for await (const chunk of readSse(res.body, signal)) yield chunk;
    return;
  }
  if (res.body && ctype.includes("json")) {
    const json = (await res.json()) as Record<string, unknown>;
    const text = extractDelta(json);
    if (text) yield text;
    return;
  }
  if (res.body) {
    for await (const chunk of readSse(res.body, signal)) yield chunk;
    return;
  }
  throw new Error("LLM 没有返回内容");
}

export async function* streamLlmChat(input: LlmChatInput, signal: AbortSignal): AsyncGenerator<string> {
  const cfg = loadConfig();
  if (!isLlmConfigured(cfg)) {
    throw new Error("尚未配置 LLM。请在设置中填写接口地址和模型名");
  }
  const messages = buildMessages(input);
  const url = resolveChatUrl(cfg.llmBaseUrl);
  const key = cfg.llmApiKey.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "HTTP-Referer": "https://github.com/Songxwn/hexo-markdown",
    "X-Title": "Hexo Markdown",
  };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    if (/azure\.com|cognitiveservices/i.test(url)) headers["api-key"] = key;
  }

  const payload = {
    model: cfg.llmModel.trim(),
    messages,
    stream: true,
    temperature: 0.7,
  };

  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const detail = await readHttpError(res);
    if ((res.status === 400 || res.status === 422) && /stream/i.test(detail || "stream")) {
      res = await fetch(url, {
        method: "POST",
        headers: { ...headers, Accept: "application/json" },
        body: JSON.stringify({ ...payload, stream: false }),
        signal,
      });
    } else {
      throw new Error(detail || `LLM 请求失败（HTTP ${res.status}）`);
    }
  }

  if (!res.ok) {
    throw new Error((await readHttpError(res)) || `LLM 请求失败（HTTP ${res.status}）`);
  }

  for await (const chunk of emitResponse(res, signal)) yield chunk;
}
