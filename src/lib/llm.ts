export const LLM_PRESETS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "qwen", name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { id: "moonshot", name: "Kimi", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-auto" },
  { id: "zhipu", name: "智谱", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "siliconflow", name: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { id: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5" },
] as const;

export type LlmMode = "continue" | "polish" | "expand" | "shorten" | "zh" | "en" | "custom";

export const LLM_ACTIONS: { id: LlmMode; label: string }[] = [
  { id: "continue", label: "续写" },
  { id: "polish", label: "润色" },
  { id: "expand", label: "扩写" },
  { id: "shorten", label: "缩写" },
  { id: "zh", label: "译中" },
  { id: "en", label: "译英" },
];

export function cleanLlmOutput(text: string): string {
  let next = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "").trim();
  const fenced = next.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) next = fenced[1].trim();
  return next;
}
