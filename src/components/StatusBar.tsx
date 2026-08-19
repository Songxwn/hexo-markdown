import { Cloud, HardDrive, Server } from "lucide-react";
import type { SshStatus } from "../lib/types";

type Props = {
  path: string | null;
  words: number;
  chars: number;
  dirty: boolean;
  r2Configured: boolean;
  ssh: SshStatus;
  uploadHint: string | null;
  onToggleLog: () => void;
};

export function StatusBar({ path, words, chars, dirty, r2Configured, ssh, uploadHint, onToggleLog }: Props) {
  return (
    <footer className="statusbar">
      <span className={dirty ? "warn" : "ok"}>{dirty ? "未保存" : "已保存"}</span>
      <span className="dim">{path || "未打开文章"}</span>
      <span className="spacer" />
      {uploadHint && <span className="hint">{uploadHint}</span>}
      <span>
        {words} 词 · {chars} 字
      </span>
      <button type="button" className="status-link" onClick={onToggleLog} title="远程日志">
        <Server size={13} />
        {ssh.connected ? `${ssh.user}@${ssh.host}` : "SSH 未连接"}
      </button>
      <span className="storage">
        {r2Configured ? <Cloud size={13} /> : <HardDrive size={13} />}
        {r2Configured ? "R2 已配置" : "未配置 R2"}
      </span>
    </footer>
  );
}
