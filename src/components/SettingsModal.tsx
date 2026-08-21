import {
  Archive,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  KeyRound,
  Loader2,
  Palette,
  Plus,
  Search,
  Server,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { LLM_PRESETS } from "../lib/llm";
import { applyTheme, DEFAULT_THEME, THEMES } from "../lib/theme";
import {
  applyTypography,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_IDS,
  FONT_LABELS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEPS,
  fontStack,
} from "../lib/typography";
import type { AppSettings, PostTemplate, TemplateSet } from "../lib/types";

type Props = {
  open: boolean;
  settings: AppSettings | null;
  templates: TemplateSet | null;
  saving: boolean;
  version?: string;
  onClose: () => void;
  onSave: (patch: Partial<AppSettings>, templates: TemplateSet) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: () => Promise<void>;
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
  theme: DEFAULT_THEME,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  llmBaseUrl: "",
  llmApiKey: "",
  llmModel: "",
};

const defaultTemplateBody = `---
title: {{ title }}
date: {{ date }}
tags:
categories:
---

`;

function cloneUserTemplates(set: TemplateSet | null): { defaultId: string; items: PostTemplate[] } {
  if (!set?.items.length) {
    return {
      defaultId: "default",
      items: [{ id: "default", name: "默认文章", body: defaultTemplateBody }],
    };
  }
  return {
    defaultId: set.defaultId,
    items: set.items.map((item) => ({ id: item.id, name: item.name, body: item.body })),
  };
}

function Hint({ children }: { children: React.ReactNode }) {
  return <small className="field-hint">{children}</small>;
}

type SettingsSection = "appearance" | "hexo" | "templates" | "llm" | "r2" | "ssh" | "backup";

const SETTINGS_NAV: { id: SettingsSection; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "外观", icon: Palette },
  { id: "hexo", label: "本地 Hexo", icon: FolderOpen },
  { id: "templates", label: "文章模板", icon: FileText },
  { id: "llm", label: "LLM 协助", icon: Sparkles },
  { id: "r2", label: "Cloudflare R2", icon: Cloud },
  { id: "ssh", label: "SSH / SFTP", icon: Server },
  { id: "backup", label: "导入 / 导出", icon: Archive },
];

function readSettingsSection(): SettingsSection {
  try {
    const id = window.localStorage.getItem("hexomd.settingsNav");
    if (SETTINGS_NAV.some((item) => item.id === id)) return id as SettingsSection;
  } catch {
    /* ignore quota */
  }
  return "appearance";
}

export function SettingsModal({ open, settings, templates, saving, version, onClose, onSave, onExport, onImport }: Props) {
  const [form, setForm] = useState(empty);
  const [tpl, setTpl] = useState(cloneUserTemplates(templates));
  const [activeTpl, setActiveTpl] = useState(tpl.defaultId);
  const [transferring, setTransferring] = useState(false);
  const [section, setSection] = useState<SettingsSection>(readSettingsSection);
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [llmModelQuery, setLlmModelQuery] = useState("");
  const [llmProbeBusy, setLlmProbeBusy] = useState(false);
  const [llmProbeError, setLlmProbeError] = useState<string | null>(null);
  const [llmProbeHint, setLlmProbeHint] = useState<string | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);

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
        theme: settings.theme || DEFAULT_THEME,
        fontFamily: settings.fontFamily || DEFAULT_FONT_FAMILY,
        fontSize: settings.fontSize || DEFAULT_FONT_SIZE,
        llmBaseUrl: settings.llmBaseUrl || "",
        llmApiKey: settings.llmApiKey || "",
        llmModel: settings.llmModel || "",
      });
      const next = cloneUserTemplates(templates);
      setTpl(next);
      setActiveTpl(next.items.some((item) => item.id === next.defaultId) ? next.defaultId : next.items[0].id);
      setLlmModels([]);
      setLlmModelQuery("");
      setLlmProbeError(null);
      setLlmProbeHint(null);
    }
  }, [open, settings, templates]);

  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [section]);

  if (!open) return null;

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const currentTpl = tpl.items.find((item) => item.id === activeTpl) || tpl.items[0];
  const shortcutMod = window.hexo?.platform === "darwin" ? "⌘" : "Ctrl";

  function patchTpl(id: string, patch: Partial<PostTemplate>) {
    setTpl((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addTpl() {
    const id = `tpl-${Date.now().toString(36)}`;
    const item: PostTemplate = { id, name: "新模板", body: defaultTemplateBody };
    setTpl((prev) => ({ ...prev, items: [...prev.items, item] }));
    setActiveTpl(id);
  }

  function removeTpl() {
    if (tpl.items.length <= 1 || !currentTpl) return;
    const rest = tpl.items.filter((item) => item.id !== currentTpl.id);
    const defaultId = tpl.defaultId === currentTpl.id ? rest[0].id : tpl.defaultId;
    setTpl({ defaultId, items: rest });
    setActiveTpl(defaultId);
  }

  function clearLlmProbe() {
    setLlmModels([]);
    setLlmModelQuery("");
    setLlmProbeError(null);
    setLlmProbeHint(null);
  }

  async function probeLlmModels() {
    const baseUrl = (form.llmBaseUrl || "").trim();
    if (!baseUrl) {
      setLlmProbeError("请先填写接口地址");
      return;
    }
    setLlmProbeBusy(true);
    setLlmProbeError(null);
    setLlmProbeHint(null);
    try {
      const result = await api.listLlmModels({
        baseUrl,
        apiKey: (form.llmApiKey || "").trim(),
      });
      setLlmModels(result.models);
      setLlmProbeHint(`读到 ${result.models.length} 个模型`);
      if (!(form.llmModel || "").trim() && result.models[0]) set("llmModel", result.models[0]);
    } catch (error) {
      setLlmModels([]);
      setLlmProbeError(error instanceof Error ? error.message : "探测失败");
    } finally {
      setLlmProbeBusy(false);
    }
  }

  const llmModelMatches = llmModels.filter((id) =>
    id.toLowerCase().includes(llmModelQuery.trim().toLowerCase()),
  );
  const llmModelShown = llmModelMatches.slice(0, 80);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>设置</h2>
          <p>
            配置只保存在本机。密钥仅用于 Cloudflare R2、SSH 服务器和你填写的 LLM 接口，不会上传到别处。标了必填的项需要先填好，对应功能才能用。
          </p>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="设置分类">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const on = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={on ? "on" : ""}
                  aria-current={on ? "page" : undefined}
                  onClick={() => {
                    setSection(item.id);
                    try {
                      window.localStorage.setItem("hexomd.settingsNav", item.id);
                    } catch {
                      /* ignore quota */
                    }
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="settings-pane" ref={paneRef}>
        {section === "appearance" ? (
          <>
        <h3>外观</h3>
        <p className="section-hint">点选即可预览，保存后写入本机配置。也可从菜单栏「视图 → 外观」切换。</p>
        <div className="skin-grid">
          {THEMES.map((skin) => {
            const selected = (form.theme || DEFAULT_THEME) === skin.id;
            return (
              <button
                key={skin.id}
                type="button"
                className={`skin-card ${selected ? "on" : ""}`}
                onClick={() => {
                  set("theme", skin.id);
                  applyTheme(skin.id, { persist: false });
                }}
              >
                <span className="skin-swatches" aria-hidden>
                  {skin.swatches.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <strong>{skin.name}</strong>
                <small>{skin.desc}</small>
              </button>
            );
          })}
        </div>

        <h3>字体</h3>
        <p className="section-hint">作用于界面、源码编辑器和右侧预览。也可从菜单栏「视图 → 字体」切换。</p>
        <div className="font-grid">
          {FONT_IDS.map((id) => {
            const meta = FONT_LABELS[id];
            const selected = (form.fontFamily || DEFAULT_FONT_FAMILY) === id;
            return (
              <button
                key={id}
                type="button"
                className={`skin-card font-card ${selected ? "on" : ""}`}
                onClick={() => {
                  set("fontFamily", id);
                  applyTypography(id, form.fontSize || DEFAULT_FONT_SIZE, { persist: false });
                }}
              >
                <span className="font-sample" style={{ fontFamily: fontStack(id) }}>
                  {meta.sample}
                </span>
                <strong>{meta.name}</strong>
                <small>{meta.desc}</small>
              </button>
            );
          })}
        </div>

        <h3>文字大小</h3>
        <p className="section-hint">
          调整整体字号，不含图片缩放。快捷键：增大 <kbd>{shortcutMod}</kbd>+<kbd>=</kbd>，减小 <kbd>{shortcutMod}</kbd>+<kbd>-</kbd>
          ，重置 <kbd>{shortcutMod}</kbd>+<kbd>0</kbd>。也可从菜单栏「视图 → 文字大小」选择。
        </p>
        <div className="type-size">
          <div className="type-size-head">
            <span>当前 {form.fontSize || DEFAULT_FONT_SIZE} px</span>
            <small>范围 {FONT_SIZE_MIN}–{FONT_SIZE_MAX}</small>
          </div>
          <input
            type="range"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={form.fontSize || DEFAULT_FONT_SIZE}
            onChange={(e) => {
              const fontSize = Number(e.target.value) || DEFAULT_FONT_SIZE;
              set("fontSize", fontSize);
              applyTypography(form.fontFamily || DEFAULT_FONT_FAMILY, fontSize, { persist: false });
            }}
          />
          <div className="type-size-marks">
            {FONT_SIZE_STEPS.map((size) => {
              const selected = (form.fontSize || DEFAULT_FONT_SIZE) === size;
              return (
                <button
                  key={size}
                  type="button"
                  className={selected ? "on" : ""}
                  onClick={() => {
                    set("fontSize", size);
                    applyTypography(form.fontFamily || DEFAULT_FONT_FAMILY, size, { persist: false });
                  }}
                >
                  {size}
                  {size === DEFAULT_FONT_SIZE ? " 标准" : ""}
                </button>
              );
            })}
          </div>
        </div>
          </>
        ) : null}

        {section === "hexo" ? (
          <>
        <h3>本地 Hexo</h3>
        <p className="section-hint">文章列表、保存和本地图片备份都基于这个目录。请指向 Hexo 站点根目录，而不是 `source/_posts`。</p>
        <label>
          博客根目录 <span className="req">必填</span>
          <div className="path-row">
            <input
              value={form.hexoRoot || ""}
              onChange={(e) => set("hexoRoot", e.target.value)}
              placeholder="例如 F:\blog 或 /Users/me/blog"
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
          <Hint>目录里应有 `_config.yml`，以及 `source/_posts`（已发布）和可选的 `source/_drafts`（草稿）。SFTP 同步也以这里为本地端。</Hint>
          {settings && settings.hexoRoot && !settings.hexoHasConfig && (
            <small className="warn-text">当前路径下没有找到 `_config.yml`，请确认这是 Hexo 根目录。</small>
          )}
        </label>
          </>
        ) : null}

        {section === "templates" ? (
          <>
        <h3>文章模板</h3>
        <p className="section-hint">
          新建文章会套用选中的模板，并把 <code>date</code> 写成当前时间。文件名只保留标题，不再加日期前缀。占位符：
          <code>{"{{ title }}"}</code>、<code>{"{{ date }}"}</code>、<code>{"{{ slug }}"}</code>。
          {templates?.scaffolds.length
            ? " 博客目录里的 scaffolds/post.md、draft.md 也会出现在新建菜单中。"
            : ""}
        </p>
        <div className="template-toolbar">
          <select value={currentTpl?.id || ""} onChange={(e) => setActiveTpl(e.target.value)}>
            {tpl.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.id === tpl.defaultId ? "（默认）" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn ghost"
            onClick={() => currentTpl && setTpl((prev) => ({ ...prev, defaultId: currentTpl.id }))}
          >
            设为默认
          </button>
          <button type="button" className="btn ghost" onClick={addTpl}>
            <Plus size={15} />
            新建
          </button>
          <button type="button" className="btn ghost" onClick={removeTpl} disabled={tpl.items.length <= 1}>
            <Trash2 size={15} />
            删除
          </button>
        </div>
        {currentTpl ? (
          <>
            <label>
              模板名称
              <input value={currentTpl.name} onChange={(e) => patchTpl(currentTpl.id, { name: e.target.value })} />
            </label>
            <label>
              模板内容
              <textarea
                value={currentTpl.body}
                onChange={(e) => patchTpl(currentTpl.id, { body: e.target.value })}
                spellCheck={false}
              />
              <Hint>保存设置后生效。`date` 即使写在模板里，新建时也会改成此刻的时间。</Hint>
            </label>
          </>
        ) : null}
          </>
        ) : null}

        {section === "llm" ? (
          <>
        <h3>LLM 协助</h3>
        <p className="section-hint">
          对接 OpenAI 兼容的 <code>/chat/completions</code> 接口，用于续写、润色、扩写等。点选预设会填入地址和默认模型，再补上自己的 Key。Ollama 等本地服务可以不填 Key。
        </p>
        <div className="llm-presets">
          {LLM_PRESETS.map((preset) => {
            const selected =
              (form.llmBaseUrl || "").replace(/\/+$/, "") === preset.baseUrl &&
              (form.llmModel || "") === preset.model;
            return (
              <button
                key={preset.id}
                type="button"
                className={selected ? "on" : ""}
                onClick={() => {
                  set("llmBaseUrl", preset.baseUrl);
                  set("llmModel", preset.model);
                  clearLlmProbe();
                }}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
        <div className="modal-grid">
          <label className="span-2">
            接口地址
            <input
              value={form.llmBaseUrl || ""}
              onChange={(e) => {
                set("llmBaseUrl", e.target.value);
                clearLlmProbe();
              }}
              placeholder="https://api.openai.com/v1"
              autoComplete="off"
            />
            <Hint>
              填到 <code>/v1</code> 即可，应用会自动补上 <code>/chat/completions</code>。若已包含完整路径则原样使用。也支持 Azure OpenAI 的完整 completions URL。点「探测模型」会请求该地址的 <code>/models</code>。
            </Hint>
          </label>
          <label className="span-2">
            模型名
            <div className="path-row">
              <input
                value={form.llmModel || ""}
                onChange={(e) => set("llmModel", e.target.value)}
                placeholder="gpt-4o-mini"
                autoComplete="off"
                list="llm-model-suggest"
              />
              <button
                type="button"
                className="btn ghost"
                disabled={llmProbeBusy}
                onClick={() => void probeLlmModels()}
              >
                {llmProbeBusy ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
                {llmProbeBusy ? "探测中" : "探测模型"}
              </button>
            </div>
            {llmModels.length > 0 ? (
              <datalist id="llm-model-suggest">
                {llmModels.slice(0, 200).map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            ) : null}
            {llmProbeError ? <small className="warn-text">{llmProbeError}</small> : null}
            {llmProbeHint && !llmProbeError ? <Hint>{llmProbeHint}，点击填入。也可继续手动输入。</Hint> : null}
            {!llmProbeHint && !llmProbeError ? (
              <Hint>
                与服务商控制台里的模型 ID 一致。填写地址和 Key 后可探测接口上的全部模型。
              </Hint>
            ) : null}
            {llmModels.length > 8 ? (
              <input
                value={llmModelQuery}
                onChange={(e) => setLlmModelQuery(e.target.value)}
                placeholder="筛选模型…"
                autoComplete="off"
              />
            ) : null}
            {llmModels.length > 0 ? (
              <div className="llm-model-list">
                {llmModelShown.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={form.llmModel === id ? "on" : ""}
                    title={id}
                    onClick={() => set("llmModel", id)}
                  >
                    {id}
                  </button>
                ))}
                {llmModelMatches.length > llmModelShown.length ? (
                  <span className="llm-model-more">还有 {llmModelMatches.length - llmModelShown.length} 个，请缩小筛选</span>
                ) : null}
                {llmModels.length > 0 && llmModelMatches.length === 0 ? (
                  <span className="llm-model-more">没有匹配的模型</span>
                ) : null}
              </div>
            ) : null}
          </label>
          <label className="span-2">
            API Key
            <input
              type="password"
              value={form.llmApiKey || ""}
              onChange={(e) => set("llmApiKey", e.target.value)}
              placeholder="留空则不修改已保存密钥"
              autoComplete="new-password"
            />
            <Hint>本地 Ollama 可留空。已保存过的 Key 留空表示不修改，不会被清空。</Hint>
          </label>
        </div>
          </>
        ) : null}

        {section === "r2" ? (
          <>
        <h3>Cloudflare R2</h3>
        <p className="section-hint">
          粘贴或拖入图片时上传到对象存储，并插入公开 URL。整组留空则改为保存到当前文章旁边的资源目录。可在 Cloudflare 控制台 → R2 → 管理 API 令牌 中创建密钥。
        </p>
        <div className="modal-grid">
          <label>
            Account ID
            <input
              value={form.r2AccountId || ""}
              onChange={(e) => set("r2AccountId", e.target.value)}
              placeholder="32 位，例如 1a2b3c…"
            />
            <Hint>Cloudflare 仪表盘右栏，或 R2 概览页的 Account ID。用于连接 https://账号ID.r2.cloudflarestorage.com。</Hint>
          </label>
          <label>
            Bucket
            <input value={form.r2Bucket || ""} onChange={(e) => set("r2Bucket", e.target.value)} placeholder="例如 hexo-images" />
            <Hint>R2 存储桶名称，需已创建，且 API 令牌对该桶有写入权限。</Hint>
          </label>
          <label>
            Access Key ID
            <input
              value={form.r2AccessKeyId || ""}
              onChange={(e) => set("r2AccessKeyId", e.target.value)}
              autoComplete="off"
              placeholder="R2 API 令牌的 Access Key"
            />
            <Hint>R2 的 S3 兼容 Access Key ID，不是 Cloudflare 登录邮箱。建议权限为该桶 Object Read & Write。</Hint>
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
            <Hint>与 Access Key 成对出现，只显示一次。已经保存过的密钥可留空，不会被清空。</Hint>
          </label>
          <label className="span-2">
            公开访问 URL
            <input
              value={form.r2PublicUrl || ""}
              onChange={(e) => set("r2PublicUrl", e.target.value)}
              placeholder="https://img.example.com 或 https://pub-xxxx.r2.dev"
            />
            <Hint>
              浏览器能打开的图片前缀，不要末尾斜杠。可用自定义域名，或 R2 桶的公开 `r2.dev` 地址。插入 Markdown 的链接为「该地址 + 对象键」。
            </Hint>
          </label>
          <label className="span-2">
            对象键前缀
            <input value={form.r2KeyPrefix || ""} onChange={(e) => set("r2KeyPrefix", e.target.value)} placeholder="hexo" />
            <Hint>对象在桶里的路径前缀，默认 `hexo`。实际上传键类似 `hexo/2026/08/20/abc123-封面.png`。</Hint>
          </label>
        </div>
          </>
        ) : null}

        {section === "ssh" ? (
          <>
        <h3>SSH / SFTP</h3>
        <p className="section-hint">
          用于拉取、推送 Markdown，以及在服务器上执行 `hexo generate` / `hexo deploy`。密码和私钥二选一即可，推荐私钥。
        </p>
        <div className="modal-grid">
          <label>
            主机
            <input value={form.sshHost || ""} onChange={(e) => set("sshHost", e.target.value)} placeholder="example.com 或 1.2.3.4" />
            <Hint>SSH 服务器的域名或 IP，不要带 `ssh://` 或端口号。</Hint>
          </label>
          <label>
            端口
            <input
              type="number"
              value={form.sshPort ?? 22}
              onChange={(e) => set("sshPort", Number(e.target.value) || 22)}
            />
            <Hint>SSH 端口，一般是 `22`。云厂商改过安全组端口时填实际端口。</Hint>
          </label>
          <label>
            用户名
            <input value={form.sshUser || ""} onChange={(e) => set("sshUser", e.target.value)} placeholder="ubuntu" />
            <Hint>登录用户，常见如 `ubuntu`、`root`、`debian`。需对该远程博客目录有读写权限。</Hint>
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
            <Hint>密码登录时填写。已改用私钥可留空。已保存的密码留空表示不修改。</Hint>
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
            <Hint>本机 OpenSSH 私钥路径，如 `id_ed25519` 或 `id_rsa`（不要选 `.pub` 公钥）。PuTTY 的 `.ppk` 需先转换成 OpenSSH 格式。</Hint>
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
            <Hint>创建密钥时设置的 passphrase。没有加密过私钥就留空。已保存的口令留空表示不修改。</Hint>
          </label>
          <label>
            远程 Hexo 根目录
            <input
              value={form.remoteHexoRoot || ""}
              onChange={(e) => set("remoteHexoRoot", e.target.value)}
              placeholder="/home/ubuntu/blog"
            />
            <Hint>服务器上的博客根目录绝对路径，需含 `_config.yml`。同步范围是该目录下的 `source/_posts` 与 `source/_drafts`。</Hint>
          </label>
          <label className="span-2">
            登录初始化
            <input
              value={form.sshInitCmd || ""}
              onChange={(e) => set("sshInitCmd", e.target.value)}
              placeholder="source ~/.nvm/nvm.sh; source ~/.bashrc"
            />
            <Hint>连上 SSH 后、进入博客目录前执行，用来加载 nvm / node。多条命令用 `;` 连接。不需要可留空。</Hint>
          </label>
          <label>
            生成命令
            <input
              value={form.sshGenerateCmd || ""}
              onChange={(e) => set("sshGenerateCmd", e.target.value)}
              placeholder="npx hexo generate"
            />
            <Hint>在远程博客根目录执行，用于「Hexo 生成」。默认 `npx hexo generate`，也可写成 `hexo g`。</Hint>
          </label>
          <label>
            部署命令
            <input
              value={form.sshDeployCmd || ""}
              onChange={(e) => set("sshDeployCmd", e.target.value)}
              placeholder="npx hexo deploy"
            />
            <Hint>用于「Hexo 部署」。默认 `npx hexo deploy`。若想一次生成并部署，也可填 `npx hexo generate --deploy`。</Hint>
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(form.autoUploadOnSave)}
            onChange={(e) => set("autoUploadOnSave", e.target.checked)}
          />
          <span>
            保存文章后自动 SFTP 上传
            <Hint>保存当前打开的文章时，自动把该 Markdown 和同名资源目录推到服务器。需先填好 SSH，并保持连接或允许自动连接。</Hint>
          </span>
        </label>
          </>
        ) : null}

        {section === "backup" ? (
          <>
        <h3>导入 / 导出</h3>
        <p className="section-hint">
          备份已保存的设置（含密钥和文章模板）到 JSON，或从文件恢复。文件请妥善保管，不要发到公开仓库。换电脑后，博客目录和 SSH 私钥路径可能要再选一次。
        </p>
        <div className="backup-row">
          <button
            type="button"
            className="btn ghost"
            disabled={saving || transferring}
            onClick={async () => {
              setTransferring(true);
              try {
                await onExport();
              } finally {
                setTransferring(false);
              }
            }}
          >
            <Download size={15} />
            导出配置…
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={saving || transferring}
            onClick={async () => {
              setTransferring(true);
              try {
                await onImport();
              } finally {
                setTransferring(false);
              }
            }}
          >
            <Upload size={15} />
            导入配置…
          </button>
        </div>
          </>
        ) : null}
          </div>
        </div>

        <footer>
          {version ? <span className="modal-version">版本 {version}</span> : <span />}
          <button className="btn ghost" type="button" onClick={onClose} disabled={saving || transferring}>
            取消
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={saving || transferring}
            onClick={() =>
              onSave(form, {
                defaultId: tpl.defaultId,
                items: tpl.items,
                scaffolds: templates?.scaffolds || [],
              })
            }
          >
            {saving ? "保存中…" : "保存设置"}
          </button>
        </footer>
      </div>
    </div>
  );
}
