import { Cloud, HardDrive, Server, Sparkles } from "lucide-react";
import type { PostOrigin, SshStatus } from "../lib/types";

type Props = {
  path: string | null;
  origin?: PostOrigin;
  words: number;
  chars: number;
  dirty: boolean;
  r2Configured: boolean;
  llmConfigured: boolean;
  llmModel: string;
  ssh: SshStatus;
  uploadHint: string | null;
  version: string;
  onToggleLog: () => void;
  onRename: () => void;
  onAbout: () => void;
  onToggleLlm: () => void;
  onOpenSettings: () => void;
};

export function StatusBar({
  path,
  origin = "local",
  words,
  chars,
  dirty,
  r2Configured,
  llmConfigured,
  llmModel,
  ssh,
  uploadHint,
  version,
  onToggleLog,
  onRename,
  onAbout,
  onToggleLlm,
  onOpenSettings,
}: Props) {
  return (
    <footer className="statusbar">
      <span className={dirty ? "warn" : "ok"}>{dirty ? "未保存" : "已保存"}</span>
      <button
        type="button"
        className="status-link path-link"
        disabled={!path}
        onClick={onRename}
        title={path ? "修改文件名（文章链接）" : "未打开文章"}
      >
        {path ? `${origin === "remote" ? "远程 · " : ""}${path}` : "未打开文章"}
      </button>
      <span className="spacer" />
      {uploadHint && <span className="hint">{uploadHint}</span>}
      <span>
        {words} 词 · {chars} 字
      </span>
      <button type="button" className="status-link" onClick={onToggleLog} title="远程日志">
        <Server size={13} />
        {ssh.connected ? `${ssh.user}@${ssh.host}` : "SSH 未连接"}
      </button>
      <button
        type="button"
        className="status-link"
        onClick={llmConfigured ? onToggleLlm : onOpenSettings}
        title={llmConfigured ? (llmModel ? `LLM · ${llmModel}` : "LLM 协助") : "配置 LLM"}
      >
        <Sparkles size={13} />
        {llmConfigured ? llmModel || "LLM 已配置" : "未配置 LLM"}
      </button>
      <span className="storage">
        {r2Configured ? <Cloud size={13} /> : <HardDrive size={13} />}
        {r2Configured ? "R2 已配置" : "未配置 R2"}
      </span>
      {version ? (
        <button type="button" className="status-link" onClick={onAbout} title="关于">
          v{version}
        </button>
      ) : null}
    </footer>
  );
}
