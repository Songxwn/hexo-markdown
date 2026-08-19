import { FolderOpen, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AppSettings } from "../lib/types";

type Props = {
  open: boolean;
  settings: AppSettings | null;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
};

const empty: Partial<AppSettings> = {
  hexoRoot: "",
  r2AccountId: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2Bucket: "",
  r2PublicUrl: "",
  r2KeyPrefix: "hexo",
  sshHost: "",
  sshPort: 22,
  sshUser: "",
  sshPassword: "",
  sshPrivateKeyPath: "",
  sshPassphrase: "",
  remoteHexoRoot: "",
  sshInitCmd: "source ~/.nvm/nvm.sh 2>/dev/null || true; source ~/.bashrc 2>/dev/null || true",
  sshGenerateCmd: "npx hexo generate",
  sshDeployCmd: "npx hexo deploy",
  autoUploadOnSave: false,
};

export function SettingsModal({ open, settings, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open && settings) {
      setForm({
        hexoRoot: settings.hexoRoot,
        r2AccountId: settings.r2AccountId,
        r2AccessKeyId: settings.r2AccessKeyId,
        r2SecretAccessKey: settings.r2SecretAccessKey,
        r2Bucket: settings.r2Bucket,
        r2PublicUrl: settings.r2PublicUrl,
        r2KeyPrefix: settings.r2KeyPrefix || "hexo",
        sshHost: settings.sshHost,
        sshPort: settings.sshPort || 22,
        sshUser: settings.sshUser,
        sshPassword: settings.sshPassword,
        sshPrivateKeyPath: settings.sshPrivateKeyPath,
        sshPassphrase: settings.sshPassphrase,
        remoteHexoRoot: settings.remoteHexoRoot,
        sshInitCmd: settings.sshInitCmd,
        sshGenerateCmd: settings.sshGenerateCmd || "npx hexo generate",
        sshDeployCmd: settings.sshDeployCmd || "npx hexo deploy",
        autoUploadOnSave: Boolean(settings.autoUploadOnSave),
      });
    }
  }, [open, settings]);

  if (!open) return null;

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>设置</h2>
          <p>配置保存在本机。密钥只用于 Cloudflare R2 和你填写的 SSH 服务器。</p>
        </header>

        <h3>本地 Hexo</h3>
        <label>
          博客根目录
          <div className="path-row">
            <input
              value={form.hexoRoot || ""}
              onChange={(e) => set("hexoRoot", e.target.value)}
              placeholder="例如 F:\blog 或 /home/me/blog"
            />
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                const dir = await api.pickDirectory();
                if (dir) set("hexoRoot", dir);
              }}
            >
              <FolderOpen size={15} />
              浏览
            </button>
          </div>
          <small>需包含 _config.yml 与 source/_posts，SFTP 会与该目录同步。</small>
          {settings && settings.hexoRoot && !settings.hexoHasConfig && (
            <small className="warn-text">当前路径下没有找到 _config.yml，请确认这是 Hexo 根目录。</small>
          )}
        </label>

        <h3>Cloudflare R2</h3>
        <div className="modal-grid">
          <label>
            Account ID
            <input value={form.r2AccountId || ""} onChange={(e) => set("r2AccountId", e.target.value)} />
          </label>
          <label>
            Bucket
            <input value={form.r2Bucket || ""} onChange={(e) => set("r2Bucket", e.target.value)} />
          </label>
          <label>
            Access Key ID
            <input value={form.r2AccessKeyId || ""} onChange={(e) => set("r2AccessKeyId", e.target.value)} autoComplete="off" />
          </label>
          <label>
            Secret Access Key
            <input
              type="password"
              value={form.r2SecretAccessKey || ""}
              onChange={(e) => set("r2SecretAccessKey", e.target.value)}
              placeholder="留空则不修改已保存密钥"
              autoComplete="new-password"
            />
          </label>
          <label className="span-2">
            公开访问 URL
            <input
              value={form.r2PublicUrl || ""}
              onChange={(e) => set("r2PublicUrl", e.target.value)}
              placeholder="https://img.example.com 或 https://pub-xxxx.r2.dev"
            />
          </label>
          <label>
            对象键前缀
            <input value={form.r2KeyPrefix || ""} onChange={(e) => set("r2KeyPrefix", e.target.value)} placeholder="hexo" />
          </label>
        </div>

        <h3>SSH / SFTP</h3>
        <div className="modal-grid">
          <label>
            主机
            <input value={form.sshHost || ""} onChange={(e) => set("sshHost", e.target.value)} placeholder="example.com" />
          </label>
          <label>
            端口
            <input
              type="number"
              value={form.sshPort ?? 22}
              onChange={(e) => set("sshPort", Number(e.target.value) || 22)}
            />
          </label>
          <label>
            用户名
            <input value={form.sshUser || ""} onChange={(e) => set("sshUser", e.target.value)} placeholder="ubuntu" />
          </label>
          <label>
            密码
            <input
              type="password"
              value={form.sshPassword || ""}
              onChange={(e) => set("sshPassword", e.target.value)}
              placeholder="使用私钥时可留空"
              autoComplete="new-password"
            />
          </label>
          <label className="span-2">
            私钥文件
            <div className="path-row">
              <input
                value={form.sshPrivateKeyPath || ""}
                onChange={(e) => set("sshPrivateKeyPath", e.target.value)}
                placeholder="例如 C:\Users\me\.ssh\id_ed25519"
              />
              <button
                type="button"
                className="btn ghost"
                onClick={async () => {
                  const file = await api.pickFile();
                  if (file) set("sshPrivateKeyPath", file);
                }}
              >
                <KeyRound size={15} />
                选择
              </button>
            </div>
          </label>
          <label>
            私钥口令
            <input
              type="password"
              value={form.sshPassphrase || ""}
              onChange={(e) => set("sshPassphrase", e.target.value)}
              placeholder="无私钥口令可留空"
              autoComplete="new-password"
            />
          </label>
          <label>
            远程 Hexo 根目录
            <input
              value={form.remoteHexoRoot || ""}
              onChange={(e) => set("remoteHexoRoot", e.target.value)}
              placeholder="/home/ubuntu/blog"
            />
          </label>
          <label className="span-2">
            登录初始化
            <input value={form.sshInitCmd || ""} onChange={(e) => set("sshInitCmd", e.target.value)} />
            <small>用于加载 nvm / node。在 cd 到博客目录之前执行。</small>
          </label>
          <label>
            生成命令
            <input value={form.sshGenerateCmd || ""} onChange={(e) => set("sshGenerateCmd", e.target.value)} />
          </label>
          <label>
            部署命令
            <input value={form.sshDeployCmd || ""} onChange={(e) => set("sshDeployCmd", e.target.value)} />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(form.autoUploadOnSave)}
            onChange={(e) => set("autoUploadOnSave", e.target.checked)}
          />
          保存文章后自动 SFTP 上传当前 Markdown（及资源目录）
        </label>

        <footer>
          <button className="btn ghost" type="button" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn primary" type="button" disabled={saving} onClick={() => onSave(form)}>
            {saving ? "保存中…" : "保存设置"}
          </button>
        </footer>
      </div>
    </div>
  );
}
