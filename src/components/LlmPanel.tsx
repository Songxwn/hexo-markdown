import { Loader2, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { LLM_ACTIONS, cleanLlmOutput, type LlmMode } from "../lib/llm";

type Props = {
  configured: boolean;
  model: string;
  article: string;
  onOpenSettings: () => void;
  getSelection: () => { text: string; from: number; to: number };
  onInsert: (text: string) => void;
  onReplaceSelection: (text: string) => void;
  onReplaceAll: (text: string) => void;
};

let nextChatId = 1;

export function LlmPanel({
  configured,
  model,
  article,
  onOpenSettings,
  getSelection,
  onInsert,
  onReplaceSelection,
  onReplaceAll,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hadSelection, setHadSelection] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => abortRef.current?.();
  }, []);

  function stop() {
    abortRef.current?.();
    abortRef.current = null;
    setBusy(false);
  }

  function run(mode: LlmMode) {
    if (!configured) {
      onOpenSettings();
      return;
    }
    const selection = getSelection().text;
    const body = article.trim();
    if (!selection.trim() && !body) {
      setError("请先打开文章，或选中一段文字");
      return;
    }
    if (mode === "custom" && !instruction.trim()) {
      setError("请输入自定义指令");
      return;
    }
    abortRef.current?.();
    const id = nextChatId++;
    setBusy(true);
    setError(null);
    setOutput("");
    setHadSelection(Boolean(selection.trim()));
    abortRef.current = api.llmChat(
      {
        id,
        mode,
        instruction: instruction.trim() || undefined,
        selection,
        article: body,
      },
      {
        onChunk(text) {
          setOutput((prev) => prev + text);
        },
        onDone() {
          abortRef.current = null;
          setBusy(false);
          setOutput((prev) => cleanLlmOutput(prev));
        },
        onError(message) {
          abortRef.current = null;
          setBusy(false);
          setError(message);
        },
      },
    );
  }

  function apply(kind: "insert" | "selection" | "all") {
    const text = cleanLlmOutput(output);
    if (!text) return;
    if (kind === "insert") onInsert(text);
    else if (kind === "selection") onReplaceSelection(text);
    else onReplaceAll(text);
  }

  const canApply = Boolean(output.trim()) && !busy;

  return (
    <aside className="llm-panel" aria-label="LLM 协助编辑">
      <div className="llm-head">
        <Sparkles size={14} />
        <span>LLM 协助</span>
        {model ? <em title={model}>{model}</em> : null}
      </div>

      {!configured ? (
        <div className="llm-empty">
          <p>尚未接入模型</p>
          <small>在设置里填写 OpenAI 兼容接口地址和模型名，可接 DeepSeek、通义、Kimi、Ollama 等。</small>
          <button type="button" className="btn ghost" onClick={onOpenSettings}>
            去设置
          </button>
        </div>
      ) : (
        <>
          <div className="llm-actions">
            {LLM_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => run(action.id)}
              >
                {action.label}
              </button>
            ))}
          </div>
          <label className="llm-prompt">
            自定义指令
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="例如：改成更口语、补一段引言…（Ctrl+Enter 发送）"
              rows={3}
              disabled={busy}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  run("custom");
                }
              }}
            />
          </label>
          <div className="llm-run">
            {busy ? (
              <button type="button" className="btn ghost" onClick={stop}>
                <Square size={12} />
                停止
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => run("custom")}>
                按指令生成
              </button>
            )}
          </div>
          <div className="llm-output" aria-live="polite">
            {busy && !output ? (
              <p className="llm-wait">
                <Loader2 size={14} className="spin" />
                正在生成…
              </p>
            ) : output ? (
              <pre className={busy ? "is-stream" : ""}>{output}</pre>
            ) : (
              <p className="llm-hint">
                有选区则处理选中文字，否则处理全文。生成后可插入光标、替换选区或替换全文。
              </p>
            )}
          </div>
          {error ? <p className="llm-error">{error}</p> : null}
          <div className="llm-apply">
            <button type="button" disabled={!canApply} onClick={() => apply("insert")}>
              插入光标
            </button>
            <button type="button" disabled={!canApply} onClick={() => apply("selection")} title={hadSelection ? "替换刚才处理的选区（以当前选区为准）" : "若无选区则在光标处写入"}>
              替换选区
            </button>
            <button type="button" disabled={!canApply} onClick={() => apply("all")}>
              替换全文
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
