import { CloudUpload, Download, Plug, PlugZap, Rocket, ScrollText, Upload } from "lucide-react";
import type { SshStatus } from "../lib/types";

type Props = {
  ssh: SshStatus;
  configured: boolean;
  hasCurrent: boolean;
  logOpen: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onPull: () => void;
  onPushCurrent: () => void;
  onPushAll: () => void;
  onGenerate: () => void;
  onDeploy: () => void;
  onFull: () => void;
  onToggleLog: () => void;
  onOpenSettings: () => void;
};

export function RemoteBar({
  ssh,
  configured,
  hasCurrent,
  logOpen,
  onConnect,
  onDisconnect,
  onPull,
  onPushCurrent,
  onPushAll,
  onGenerate,
  onDeploy,
  onFull,
  onToggleLog,
  onOpenSettings,
}: Props) {
  if (!configured) {
    return (
      <div className="remote-bar">
        <span className="toolbar-note">未配置 SSH / SFTP</span>
        <button className="text-btn" onClick={onOpenSettings}>
          去设置
        </button>
      </div>
    );
  }

  const disabled = ssh.busy;

  return (
    <div className="remote-bar">
      <span className={`ssh-dot ${ssh.connected ? "on" : ""}`} />
      <span className="toolbar-note">
        {ssh.connected ? `${ssh.user}@${ssh.host}` : "未连接"}
        {ssh.busy ? " · 工作中" : ""}
      </span>
      {ssh.connected ? (
        <button disabled={disabled} onClick={onDisconnect} title="断开 SSH">
          <PlugZap size={14} />
        </button>
      ) : (
        <button disabled={disabled} onClick={onConnect} title="连接 SSH">
          <Plug size={14} />
        </button>
      )}
      <button disabled={disabled || !ssh.connected} onClick={onPull} title="从服务器拉取 Markdown">
        <Download size={14} />
      </button>
      <button disabled={disabled || !ssh.connected || !hasCurrent} onClick={onPushCurrent} title="推送当前文章">
        <Upload size={14} />
      </button>
      <button disabled={disabled || !ssh.connected} onClick={onPushAll} title="推送全部文章">
        <CloudUpload size={14} />
      </button>
      <button disabled={disabled || !ssh.connected} onClick={onGenerate} title="远程 hexo generate">
        生成
      </button>
      <button disabled={disabled || !ssh.connected} onClick={onDeploy} title="远程 hexo deploy">
        部署
      </button>
      <button disabled={disabled || !ssh.connected} onClick={onFull} title="远程生成并部署">
        <Rocket size={14} />
      </button>
      <button className={logOpen ? "on" : ""} onClick={onToggleLog} title="远程日志">
        <ScrollText size={14} />
      </button>
    </div>
  );
}
