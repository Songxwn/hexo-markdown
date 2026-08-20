import {
  Bold,
  Check,
  Code,
  Heading,
  ImagePlus,
  Info,
  Italic,
  Link,
  List,
  ListTree,
  Loader2,
  Plus,
  Quote,
  Save,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AboutModal } from "./components/AboutModal";
import { ActionFx, originFrom, type ActionFxKind, type ActionFxState } from "./components/ActionFx";
import { EditorPane, type EditorHandle, type EditorScrollPos } from "./components/EditorPane";
import { NewPostModal } from "./components/NewPostModal";
import { Outline } from "./components/Outline";
import { Preview, type PreviewHandle } from "./components/Preview";
import { RemoteBar } from "./components/RemoteBar";
import { RemoteLog } from "./components/RemoteLog";
import { RenamePostModal } from "./components/RenamePostModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar, type SidebarTab } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { api } from "./lib/api";
import { countWords, extractHeadings, imageFileName, parseTitle } from "./lib/markdown";
import { applyTheme, normalizeTheme } from "./lib/theme";
import type { AppInfo, AppSettings, PostFolder, PostOrigin, PostSummary, SshLogEvent, SshStatus, TemplateSet } from "./lib/types";

type Toast = { kind: "ok" | "err"; text: string };

function readOutlineOpen(): boolean {
  try {
    return window.localStorage.getItem("hexomd.outline") !== "0";
  } catch {
    return true;
  }
}

export default function App() {
  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const outlineLock = useRef(0);
  const editorScrollRef = useRef<EditorScrollPos>({ line: 0, totalLines: 1, atStart: true, atEnd: false });
  const syncRaf = useRef(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<TemplateSet | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [remotePosts, setRemotePosts] = useState<PostSummary[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("all");
  const [path, setPath] = useState<string | null>(null);
  const [editingOrigin, setEditingOrigin] = useState<PostOrigin>("local");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const [split, setSplit] = useState(52);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ path: string; name: string; origin: PostOrigin } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [ssh, setSsh] = useState<SshStatus>({ connected: false, host: "", user: "", busy: false });
  const [sshLogs, setSshLogs] = useState<SshLogEvent[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(readOutlineOpen);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [actionFx, setActionFx] = useState<ActionFxState | null>(null);
  const [remoteKind, setRemoteKind] = useState<"deploy" | "other" | null>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const deployBtnRef = useRef<HTMLButtonElement>(null);
  const rocketBtnRef = useRef<HTMLButtonElement>(null);
  const saveFlashTimer = useRef(0);

  const dirty = content !== saved;
  const words = useMemo(() => countWords(content), [content]);
  const headings = useMemo(() => extractHeadings(content), [content]);
  const title = parseTitle(content) || path?.split("/").pop() || "Hexo Markdown";

  const notify = useCallback((kind: Toast["kind"], text: string) => {
    setToast({ kind, text });
  }, []);

  const playFx = useCallback((kind: ActionFxKind, el: HTMLElement | null) => {
    const origin = originFrom(el);
    if (!origin) return;
    setActionFx({ kind, ...origin, key: Date.now() });
  }, []);

  const clearFx = useCallback(() => setActionFx(null), []);

  const toggleOutline = useCallback(() => {
    setOutlineOpen((open) => {
      const next = !open;
      try {
        window.localStorage.setItem("hexomd.outline", next ? "1" : "0");
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  const setVisibleHeading = useCallback((id: string | null) => {
    if (Date.now() < outlineLock.current) return;
    setActiveHeadingId(id);
  }, []);

  const jumpToHeading = useCallback((heading: { id: string; line: number }) => {
    outlineLock.current = Date.now() + 600;
    setActiveHeadingId(heading.id);
    previewRef.current?.scrollToHeading(heading.id);
    editorRef.current?.gotoLine(heading.line);
  }, []);

  const syncPreviewToEditor = useCallback((pos: EditorScrollPos) => {
    editorScrollRef.current = pos;
    if (Date.now() < outlineLock.current) return;
    if (syncRaf.current) cancelAnimationFrame(syncRaf.current);
    syncRaf.current = requestAnimationFrame(() => {
      previewRef.current?.scrollToSourceLine(pos);
    });
  }, []);

  const restorePreviewScroll = useCallback(() => {
    if (Date.now() < outlineLock.current) return;
    previewRef.current?.scrollToSourceLine(editorScrollRef.current);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(saveFlashTimer.current);
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

  const refreshRemotePosts = useCallback(async (silent = false) => {
    if (!ssh.connected) {
      setRemotePosts([]);
      setRemoteError(null);
      return;
    }
    if (!silent) setLoadingRemote(true);
    try {
      setRemotePosts(await api.remotePosts());
      setRemoteError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法读取远程文章";
      setRemoteError(message);
      if (!silent) notify("err", message);
    } finally {
      setLoadingRemote(false);
    }
  }, [notify, ssh.connected]);

  const boot = useCallback(async () => {
    try {
      const [next, info, tpl] = await Promise.all([
        api.settings(),
        api.appInfo().catch(() => null),
        api.templates().catch(() => null),
      ]);
      setSettings(next);
      if (tpl) setTemplates(tpl);
      applyTheme(normalizeTheme(next.theme));
      if (info) setAppInfo(info);
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
    return api.onTheme((theme) => {
      const id = normalizeTheme(theme);
      applyTheme(id);
      setSettings((prev) => (prev ? { ...prev, theme: id } : prev));
    });
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    editorScrollRef.current = { line: 0, totalLines: 1, atStart: true, atEnd: false };
    setActiveHeadingId(null);
  }, [path, editingOrigin]);

  const openPost = useCallback(
    async (post: PostSummary) => {
      if (dirty && !window.confirm("当前文章未保存，确定切换？")) return;
      try {
        const origin = post.origin || "local";
        const file = await api.readPost(post.path, origin);
        setPath(file.path);
        setEditingOrigin(origin);
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
      await api.savePost(path, content, editingOrigin);
      setSaved(content);
      if (editingOrigin === "remote") {
        notify("ok", "已保存到服务器");
        await refreshRemotePosts(true);
      } else if (settings?.autoUploadOnSave && settings.sshConfigured) {
        setLogOpen(true);
        const result = await api.sshPush(path);
        notify("ok", `已保存并上传 ${result.files} 个文件`);
        await refreshPosts();
      } else {
        notify("ok", "已保存");
        await refreshPosts();
      }
      playFx("save", saveBtnRef.current);
      setSaveFlash(true);
      window.clearTimeout(saveFlashTimer.current);
      saveFlashTimer.current = window.setTimeout(() => setSaveFlash(false), 1200);
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingPost(false);
    }
  }, [
    content,
    editingOrigin,
    notify,
    path,
    refreshPosts,
    refreshRemotePosts,
    settings?.autoUploadOnSave,
    settings?.sshConfigured,
    playFx,
  ]);

  const createPost = useCallback(
    async (postTitle: string, folder: PostFolder, templateId: string) => {
      const origin: PostOrigin = sidebarTab === "posts" ? "remote" : "local";
      if (origin === "remote" && !ssh.connected) {
        notify("err", "请先连接 SSH，才能在服务器上新建已发布文章");
        throw new Error("SSH 未连接");
      }
      try {
        const file = await api.createPost(postTitle, folder, templateId, origin);
        setPath(file.path);
        setEditingOrigin(origin);
        setContent(file.content);
        setSaved(file.content);
        setNewOpen(false);
        notify("ok", origin === "remote" ? "已在服务器创建" : "已创建");
        if (origin === "remote") await refreshRemotePosts();
        else await refreshPosts();
      } catch (error) {
        notify("err", error instanceof Error ? error.message : "创建失败");
        throw error;
      }
    },
    [notify, refreshPosts, refreshRemotePosts, sidebarTab, ssh.connected],
  );

  const deletePost = useCallback(
    async (post: PostSummary) => {
      const origin = post.origin || "local";
      const where = origin === "remote" ? "服务器上的" : "";
      if (!window.confirm(`删除${where}「${post.title}」？此操作不可撤销。`)) return;
      try {
        await api.deletePost(post.path, origin);
        if (path === post.path && editingOrigin === origin) {
          setPath(null);
          setContent("");
          setSaved("");
        }
        notify("ok", origin === "remote" ? "已从服务器删除" : "已删除");
        if (origin === "remote") await refreshRemotePosts();
        else await refreshPosts();
      } catch (error) {
        notify("err", error instanceof Error ? error.message : "删除失败");
      }
    },
    [editingOrigin, notify, path, refreshPosts, refreshRemotePosts],
  );

  const openRename = useCallback((postPath: string, name?: string, origin: PostOrigin = editingOrigin) => {
    setRenameTarget({
      path: postPath,
      name: name || postPath.split("/").pop() || "",
      origin,
    });
  }, [editingOrigin]);

  const renamePost = useCallback(
    async (fromPath: string, nextName: string) => {
      const origin = renameTarget?.origin || editingOrigin;
      try {
        const result = await api.renamePost(fromPath, nextName, origin);
        if (path === fromPath && editingOrigin === origin) {
          setPath(result.path);
        }
        setRenameTarget(null);
        const filename = result.path.split("/").pop() || result.path;
        notify("ok", `已重命名为 ${filename}`);
        if (origin === "remote") await refreshRemotePosts();
        else await refreshPosts();
      } catch (error) {
        notify("err", error instanceof Error ? error.message : "重命名失败");
        throw error;
      }
    },
    [editingOrigin, notify, path, refreshPosts, refreshRemotePosts, renameTarget?.origin],
  );

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>, nextTemplates: TemplateSet) => {
      setSavingSettings(true);
      try {
        const next = await api.saveSettings(patch);
        const tpl = await api.saveTemplates(nextTemplates);
        setSettings(next);
        setTemplates(tpl);
        applyTheme(normalizeTheme(next.theme));
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
        const result = await api.uploadImage(file, path, editingOrigin);
        editorRef.current?.replaceText(placeholder, `![${name}](${result.url})`);
        const hint =
          result.storage === "r2"
            ? "图片已上传到 R2"
            : result.storage === "remote"
              ? "图片已保存到服务器资源目录"
              : "R2 未配置，已写入文章资源目录";
        setUploadHint(hint);
        notify("ok", hint);
      } catch (error) {
        const message = error instanceof Error ? error.message : "上传失败";
        editorRef.current?.replaceText(placeholder, `<!-- 上传失败：${message} -->`);
        setUploadHint(message);
        notify("err", message);
      }
    },
    [notify, path, editingOrigin, settings?.r2Configured],
  );

  const runRemote = useCallback(
    async (label: string, fn: () => Promise<unknown>, fx?: { kind: ActionFxKind; el: HTMLElement | null }) => {
      setLogOpen(true);
      setRemoteKind(fx?.kind === "deploy" ? "deploy" : "other");
      try {
        await fn();
        notify("ok", label);
        if (fx) playFx(fx.kind, fx.el);
        await refreshPosts();
        await refreshRemotePosts(true);
      } catch (error) {
        notify("err", error instanceof Error ? error.message : label);
      } finally {
        setRemoteKind(null);
      }
    },
    [notify, playFx, refreshPosts, refreshRemotePosts],
  );

  useEffect(() => {
    if (ssh.connected) {
      void refreshRemotePosts();
      return;
    }
    setRemotePosts([]);
    setRemoteError(null);
  }, [refreshRemotePosts, ssh.connected]);

  useEffect(() => {
    if (sidebarTab !== "posts" || !ssh.connected) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (ssh.busy) return;
      void refreshRemotePosts(true);
    }, 12000);
    return () => window.clearInterval(id);
  }, [refreshRemotePosts, sidebarTab, ssh.busy, ssh.connected]);

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
        if (action === "new") {
          if (sidebarTab === "posts" && !ssh.connected) {
            notify("err", "请先连接 SSH，才能在服务器上新建已发布文章");
            return;
          }
          setNewOpen(true);
        }
        if (action === "rename") {
          if (!path) {
            notify("err", "请先打开一篇文章");
            return;
          }
          openRename(path, undefined, editingOrigin);
        }
        if (action === "settings") setSettingsOpen(true);
        if (action === "about") setAboutOpen(true);
        if (action === "outline") toggleOutline();
        if (action === "ssh-connect") void runRemote("已连接 SSH", () => api.sshConnect());
        if (action === "ssh-disconnect") void runRemote("已断开 SSH", () => api.sshDisconnect());
        if (action === "ssh-pull") void runRemote("拉取完成", () => api.sshPull());
        if (action === "ssh-push-current") {
          if (!path) {
            notify("err", "请先打开一篇文章");
            return;
          }
          if (editingOrigin === "remote") {
            notify("ok", "当前是远程文章，保存即写回服务器");
            return;
          }
          void runRemote("已推送当前文章", () => api.sshPush(path));
        }
        if (action === "ssh-push-all") void runRemote("已推送全部文章", () => api.sshPush());
        if (action === "hexo-generate") void runRemote("生成完成", () => api.sshExec("generate"));
        if (action === "hexo-deploy") {
          void runRemote("部署完成", () => api.sshExec("deploy"), {
            kind: "deploy",
            el: deployBtnRef.current,
          });
        }
        if (action === "hexo-full") {
          void runRemote("生成并部署完成", () => api.sshExec("full"), {
            kind: "deploy",
            el: rocketBtnRef.current,
          });
        }
      });
    } catch {
      return undefined;
    }
  }, [editingOrigin, notify, openRename, path, runRemote, savePost, sidebarTab, ssh.connected, toggleOutline]);

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
          {path ? `${editingOrigin === "remote" ? "远程 · " : ""}${title}` : "未打开文章"}
          {dirty ? <span className="dirty-dot" title="未保存" /> : null}
        </div>
        <div className="title-actions">
          <button
            className="btn ghost"
            onClick={() => {
              if (sidebarTab === "posts" && !ssh.connected) {
                notify("err", "请先连接 SSH，才能在服务器上新建已发布文章");
                return;
              }
              setNewOpen(true);
            }}
          >
            <Plus size={15} />
            新建
          </button>
          <button
            ref={saveBtnRef}
            className={`btn primary${savingPost ? " is-busy" : ""}${saveFlash ? " is-ok" : ""}`}
            onClick={() => void savePost()}
            disabled={savingPost || !path}
          >
            {savingPost ? <Loader2 size={15} className="spin" /> : saveFlash ? <Check size={15} /> : <Save size={15} />}
            {savingPost ? "保存中" : saveFlash ? "已保存" : "保存"}
          </button>
          <button className="icon-btn" title="关于" onClick={() => setAboutOpen(true)}>
            <Info size={16} />
          </button>
          <button className="icon-btn" title="设置" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
          </button>
        </div>
      </header>

      <div className="body">
        <Sidebar
          posts={posts}
          remotePosts={remotePosts}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          activePath={path}
          activeOrigin={editingOrigin}
          ssh={ssh}
          sshConfigured={Boolean(settings?.sshConfigured)}
          loadingRemote={loadingRemote}
          remoteError={remoteError}
          onOpen={(p) => void openPost(p)}
          onRename={(p) => openRename(p.path, p.name, p.origin)}
          onDelete={(p) => void deletePost(p)}
          onConnect={() => void runRemote("已连接 SSH", () => api.sshConnect())}
          onOpenSettings={() => setSettingsOpen(true)}
        />

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
            <span className="toolbar-sep" />
            <button onClick={pickImage} title="插入图片并上传">
              <ImagePlus size={15} />
            </button>
            <button
              className={outlineOpen ? "on" : ""}
              onClick={toggleOutline}
              title="大纲 Ctrl+Shift+O"
              disabled={!path}
            >
              <ListTree size={15} />
            </button>
            <span className="toolbar-note">
              {editingOrigin === "remote"
                ? "远程文章 · 保存即写回服务器"
                : "粘贴或拖入图片 → 自动上传 R2"}
            </span>
            {(loadingList || loadingRemote) && (
              <span className="toolbar-note">
                {loadingRemote && sidebarTab === "posts" ? "正在读取远程文章…" : "正在读取文章…"}
              </span>
            )}
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
              if (editingOrigin === "remote") {
                notify("ok", "当前是远程文章，保存即写回服务器");
                return;
              }
              void runRemote("已推送当前文章", () => api.sshPush(path));
            }}
            onPushAll={() => void runRemote("已推送全部文章", () => api.sshPush())}
            onGenerate={() => void runRemote("生成完成", () => api.sshExec("generate"))}
            onDeploy={() =>
              void runRemote("部署完成", () => api.sshExec("deploy"), {
                kind: "deploy",
                el: deployBtnRef.current,
              })
            }
            onFull={() =>
              void runRemote("生成并部署完成", () => api.sshExec("full"), {
                kind: "deploy",
                el: rocketBtnRef.current,
              })
            }
            onToggleLog={() => setLogOpen((open) => !open)}
            onOpenSettings={() => setSettingsOpen(true)}
            launching={remoteKind === "deploy"}
            deployRef={deployBtnRef}
            rocketRef={rocketBtnRef}
          />

          {path ? (
            <div className="split">
              <div className="pane editor-pane" style={{ width: `${split}%` }}>
                <EditorPane
                  ref={editorRef}
                  value={content}
                  onChange={setContent}
                  onPasteImage={handlePasteImage}
                  onScroll={syncPreviewToEditor}
                />
              </div>
              <div className="divider" onMouseDown={startResize} />
              <div className="preview-stage">
                <div className="pane preview-pane">
                  <Preview
                    ref={previewRef}
                    markdown={content}
                    postPath={path}
                    origin={editingOrigin}
                    onActiveHeading={setVisibleHeading}
                    onRender={restorePreviewScroll}
                  />
                </div>
                {outlineOpen ? (
                  <Outline headings={headings} activeId={activeHeadingId} onSelect={jumpToHeading} />
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty-workspace">
              <span className="mark empty-mark" aria-hidden />
              <h1>{sidebarTab === "posts" ? "查看远程已发布文章" : "从一篇文章开始"}</h1>
              <p>
                {sidebarTab === "posts"
                  ? "连接 SSH 后，左侧「已发布」会实时列出服务器 source/_posts。打开即可修改或删除，保存会写回远程。"
                  : "选择左侧列表，或新建 Markdown。粘贴截图会上传到 Cloudflare R2，并插入公开 URL。"}
              </p>
              <div className="empty-actions">
                <button
                  className="btn primary"
                  onClick={() => {
                    if (sidebarTab === "posts" && !ssh.connected) {
                      notify("err", "请先连接 SSH，才能在服务器上新建已发布文章");
                      return;
                    }
                    setNewOpen(true);
                  }}
                >
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
        origin={editingOrigin}
        words={words.words}
        chars={words.chars}
        dirty={dirty}
        r2Configured={Boolean(settings?.r2Configured)}
        ssh={ssh}
        uploadHint={uploadHint}
        version={appInfo?.version || ""}
        onToggleLog={() => setLogOpen((open) => !open)}
        onRename={() => {
          if (!path) {
            notify("err", "请先打开一篇文章");
            return;
          }
          openRename(path, undefined, editingOrigin);
        }}
        onAbout={() => setAboutOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        templates={templates}
        saving={savingSettings}
        version={appInfo?.version}
        onClose={() => {
          if (settings) applyTheme(normalizeTheme(settings.theme));
          setSettingsOpen(false);
        }}
        onSave={saveSettings}
      />
      <NewPostModal
        open={newOpen}
        templates={templates}
        remote={sidebarTab === "posts"}
        defaultFolder={sidebarTab === "drafts" ? "drafts" : "posts"}
        onClose={() => setNewOpen(false)}
        onCreate={createPost}
      />
      <RenamePostModal
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={renamePost}
      />
      <AboutModal
        open={aboutOpen}
        name={appInfo?.name || "Hexo Markdown"}
        version={appInfo?.version || ""}
        electron={appInfo?.electron || ""}
        chrome={appInfo?.chrome || ""}
        onClose={() => setAboutOpen(false)}
      />

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
      <ActionFx key={actionFx?.key ?? "idle"} fx={actionFx} onDone={clearFx} />
    </div>
  );
}
