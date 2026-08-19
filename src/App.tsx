import {
  Bold,
  Code,
  Heading,
  ImagePlus,
  Italic,
  Link,
  List,
  Plus,
  Quote,
  Save,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorPane, type EditorHandle } from "./components/EditorPane";
import { NewPostModal } from "./components/NewPostModal";
import { Preview } from "./components/Preview";
import { RemoteBar } from "./components/RemoteBar";
import { RemoteLog } from "./components/RemoteLog";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { api } from "./lib/api";
import { countWords, imageFileName, parseTitle } from "./lib/markdown";
import type { AppSettings, PostFolder, PostSummary, SshLogEvent, SshStatus } from "./lib/types";

type Toast = { kind: "ok" | "err"; text: string };

export default function App() {
  const editorRef = useRef<EditorHandle>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [path, setPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const [split, setSplit] = useState(52);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [ssh, setSsh] = useState<SshStatus>({ connected: false, host: "", user: "", busy: false });
  const [sshLogs, setSshLogs] = useState<SshLogEvent[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const dirty = content !== saved;
  const words = useMemo(() => countWords(content), [content]);
  const title = parseTitle(content) || path?.split("/").pop() || "Hexo Markdown";

  const notify = useCallback((kind: Toast["kind"], text: string) => {
    setToast({ kind, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const refreshPosts = useCallback(async () => {
    setLoadingList(true);
    try {
      setPosts(await api.posts());
    } catch (error) {
      setPosts([]);
      notify("err", error instanceof Error ? error.message : "无法读取文章列表");
    } finally {
      setLoadingList(false);
    }
  }, [notify]);

  const boot = useCallback(async () => {
    try {
      const next = await api.settings();
      setSettings(next);
      try {
        setSsh(await api.sshStatus());
      } catch {
        /* ignore */
      }
      if (next.hexoValid) await refreshPosts();
      else setSettingsOpen(true);
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "无法加载设置");
    }
  }, [notify, refreshPosts]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const openPost = useCallback(
    async (post: PostSummary) => {
      if (dirty && !window.confirm("当前文章未保存，确定切换？")) return;
      try {
        const file = await api.readPost(post.path);
        setPath(file.path);
        setContent(file.content);
        setSaved(file.content);
      } catch (error) {
        notify("err", error instanceof Error ? error.message : "打开失败");
      }
    },
    [dirty, notify],
  );

  const savePost = useCallback(async () => {
    if (!path) {
      notify("err", "请先打开或新建一篇文章");
      return;
    }
    setSavingPost(true);
    try {
      await api.savePost(path, content);
      setSaved(content);
      if (settings?.autoUploadOnSave && settings.sshConfigured) {
        setLogOpen(true);
        const result = await api.sshPush(path);
        notify("ok", `已保存并上传 ${result.files} 个文件`);
      } else {
        notify("ok", "已保存");
      }
      await refreshPosts();
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingPost(false);
    }
  }, [content, notify, path, refreshPosts, settings?.autoUploadOnSave, settings?.sshConfigured]);

  const createPost = useCallback(
    async (postTitle: string, folder: PostFolder) => {
      try {
        const file = await api.createPost(postTitle, folder);
        setPath(file.path);
        setContent(file.content);
        setSaved(file.content);
        setNewOpen(false);
        notify("ok", "已创建");
        await refreshPosts();
      } catch (error) {
        notify("err", error instanceof Error ? error.message : "创建失败");
        throw error;
      }
    },
    [notify, refreshPosts],
  );

  const deletePost = useCallback(
    async (post: PostSummary) => {
      if (!window.confirm(`删除「${post.title}」？此操作不可撤销。`)) return;
      try {
        await api.deletePost(post.path);
        if (path === post.path) {
          setPath(null);
          setContent("");
          setSaved("");
        }
        notify("ok", "已删除");
        await refreshPosts();
      } catch (error) {
        notify("err", error instanceof Error ? error.message : "删除失败");
      }
    },
    [notify, path, refreshPosts],
  );

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      setSavingSettings(true);
      try {
        const next = await api.saveSettings(patch);
        setSettings(next);
        setSettingsOpen(false);
        notify("ok", "设置已保存");
        if (next.hexoValid) await refreshPosts();
      } catch (error) {
        notify("err", error instanceof Error ? error.message : "保存设置失败");
      } finally {
        setSavingSettings(false);
      }
    },
    [notify, refreshPosts],
  );

  const handlePasteImage = useCallback(
    async (file: File) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const name = imageFileName(file);
      const placeholder = `![${name}](uploading:${id})`;
      editorRef.current?.insertAtCursor(`${placeholder}\n`);
      setUploadHint(settings?.r2Configured ? "正在上传到 Cloudflare R2…" : "正在保存图片…");
      try {
        const result = await api.uploadImage(file, path);
        editorRef.current?.replaceText(placeholder, `![${name}](${result.url})`);
        const hint =
          result.storage === "r2" ? "图片已上传到 R2" : "R2 未配置，已写入文章资源目录";
        setUploadHint(hint);
        notify("ok", hint);
      } catch (error) {
        const message = error instanceof Error ? error.message : "上传失败";
        editorRef.current?.replaceText(placeholder, `<!-- 上传失败：${message} -->`);
        setUploadHint(message);
        notify("err", message);
      }
    },
    [notify, path, settings?.r2Configured],
  );

  const runRemote = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      setLogOpen(true);
      try {
        await fn();
        notify("ok", label);
        await refreshPosts();
      } catch (error) {
        notify("err", error instanceof Error ? error.message : label);
      }
    },
    [notify, refreshPosts],
  );

  useEffect(() => {
    try {
      const offLog = api.onSshLog((event) => {
        setSshLogs((prev) => [...prev.slice(-400), event]);
      });
      const offStatus = api.onSshStatus((status) => setSsh(status));
      return () => {
        offLog();
        offStatus();
      };
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    try {
      api.setDirty(dirty);
    } catch {
      /* preload 尚未就绪时忽略 */
    }
  }, [dirty]);

  useEffect(() => {
    try {
      return api.onMenu((action) => {
        if (action === "save") void savePost();
        if (action === "new") setNewOpen(true);
        if (action === "settings") setSettingsOpen(true);
        if (action === "ssh-connect") void runRemote("已连接 SSH", () => api.sshConnect());
        if (action === "ssh-disconnect") void runRemote("已断开 SSH", () => api.sshDisconnect());
        if (action === "ssh-pull") void runRemote("拉取完成", () => api.sshPull());
        if (action === "ssh-push-current") {
          if (!path) {
            notify("err", "请先打开一篇文章");
            return;
          }
          void runRemote("已推送当前文章", () => api.sshPush(path));
        }
        if (action === "ssh-push-all") void runRemote("已推送全部文章", () => api.sshPush());
        if (action === "hexo-generate") void runRemote("生成完成", () => api.sshExec("generate"));
        if (action === "hexo-deploy") void runRemote("部署完成", () => api.sshExec("deploy"));
        if (action === "hexo-full") void runRemote("生成并部署完成", () => api.sshExec("full"));
      });
    } catch {
      return undefined;
    }
  }, [notify, path, runRemote, savePost]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const workspace = document.querySelector(".split") as HTMLElement | null;
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      const next = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(72, Math.max(28, next)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const pickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handlePasteImage(file);
    };
    input.click();
  };

  return (
    <div className="shell">
      <header className="titlebar">
        <div className="brand">
          <span className="mark" aria-hidden />
          <div>
            <strong>Hexo Markdown</strong>
            <small>{settings?.hexoRoot || "尚未绑定博客目录"}</small>
          </div>
        </div>
        <div className="title-center" title={path || ""}>
          {path ? title : "未打开文章"}
          {dirty ? " ·" : ""}
        </div>
        <div className="title-actions">
          <button className="btn ghost" onClick={() => setNewOpen(true)}>
            <Plus size={15} />
            新建
          </button>
          <button className="btn primary" onClick={() => void savePost()} disabled={savingPost || !path}>
            <Save size={15} />
            {savingPost ? "保存中" : "保存"}
          </button>
          <button className="icon-btn" title="设置" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
          </button>
        </div>
      </header>

      <div className="body">
        <Sidebar posts={posts} activePath={path} onOpen={(p) => void openPost(p)} onDelete={(p) => void deletePost(p)} />

        <section className="workspace">
          <div className="toolbar">
            <button onClick={() => editorRef.current?.wrapSelection("# ", "")} title="标题">
              <Heading size={15} />
            </button>
            <button onClick={() => editorRef.current?.wrapSelection("**")} title="粗体 Ctrl+B">
              <Bold size={15} />
            </button>
            <button onClick={() => editorRef.current?.wrapSelection("*")} title="斜体">
              <Italic size={15} />
            </button>
            <button onClick={() => editorRef.current?.wrapSelection("`")} title="行内代码">
              <Code size={15} />
            </button>
            <button onClick={() => editorRef.current?.wrapSelection("[", "](url)")} title="链接">
              <Link size={15} />
            </button>
            <button onClick={() => editorRef.current?.wrapSelection("> ", "")} title="引用">
              <Quote size={15} />
            </button>
            <button onClick={() => editorRef.current?.wrapSelection("- ", "")} title="列表">
              <List size={15} />
            </button>
            <button onClick={pickImage} title="插入图片并上传">
              <ImagePlus size={15} />
            </button>
            <span className="toolbar-note">粘贴或拖入图片 → 自动上传 R2</span>
            {loadingList && <span className="toolbar-note">正在读取文章…</span>}
          </div>
          <RemoteBar
            ssh={ssh}
            configured={Boolean(settings?.sshConfigured)}
            hasCurrent={Boolean(path)}
            logOpen={logOpen}
            onConnect={() => void runRemote("已连接 SSH", () => api.sshConnect())}
            onDisconnect={() => void runRemote("已断开 SSH", () => api.sshDisconnect())}
            onPull={() => void runRemote("拉取完成", () => api.sshPull())}
            onPushCurrent={() => {
              if (!path) {
                notify("err", "请先打开一篇文章");
                return;
              }
              void runRemote("已推送当前文章", () => api.sshPush(path));
            }}
            onPushAll={() => void runRemote("已推送全部文章", () => api.sshPush())}
            onGenerate={() => void runRemote("生成完成", () => api.sshExec("generate"))}
            onDeploy={() => void runRemote("部署完成", () => api.sshExec("deploy"))}
            onFull={() => void runRemote("生成并部署完成", () => api.sshExec("full"))}
            onToggleLog={() => setLogOpen((open) => !open)}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {path ? (
            <div className="split">
              <div className="pane editor-pane" style={{ width: `${split}%` }}>
                <EditorPane ref={editorRef} value={content} onChange={setContent} onPasteImage={handlePasteImage} />
              </div>
              <div className="divider" onMouseDown={startResize} />
              <div className="pane preview-pane">
                <Preview markdown={content} postPath={path} />
              </div>
            </div>
          ) : (
            <div className="empty-workspace">
              <h1>从一篇文章开始</h1>
              <p>选择左侧列表，或新建 Markdown。粘贴截图会上传到 Cloudflare R2，并插入公开 URL。</p>
              <div className="empty-actions">
                <button className="btn primary" onClick={() => setNewOpen(true)}>
                  新建文章
                </button>
                <button className="btn ghost" onClick={() => setSettingsOpen(true)}>
                  配置 Hexo / SSH / R2
                </button>
              </div>
            </div>
          )}
          <RemoteLog open={logOpen} lines={sshLogs} onClear={() => setSshLogs([])} />
        </section>
      </div>

      <StatusBar
        path={path}
        words={words.words}
        chars={words.chars}
        dirty={dirty}
        r2Configured={Boolean(settings?.r2Configured)}
        ssh={ssh}
        uploadHint={uploadHint}
        onToggleLog={() => setLogOpen((open) => !open)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        saving={savingSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
      <NewPostModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={createPost} />

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
