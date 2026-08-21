import { Cloud, FileText, Pencil, Plug, Search, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PostOrigin, PostSummary, SshStatus } from "../lib/types";

export type SidebarTab = "all" | "posts" | "drafts";

type Tip = { text: string; left: number; top: number; below: boolean };

type Props = {
  posts: PostSummary[];
  remotePosts: PostSummary[];
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  activePath: string | null;
  activeOrigin: PostOrigin;
  ssh: SshStatus;
  sshConfigured: boolean;
  loadingRemote: boolean;
  remoteError: string | null;
  onOpen: (post: PostSummary) => void;
  onRename: (post: PostSummary) => void;
  onPublish: (post: PostSummary) => void;
  onDelete: (post: PostSummary) => void;
  onConnect: () => void;
  onOpenSettings: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
};

function tipFromEl(el: HTMLElement, text: string): Tip {
  const rect = el.getBoundingClientRect();
  const spaceRight = window.innerWidth - rect.right;
  const below = spaceRight < 180;
  return {
    text,
    left: below ? Math.max(8, rect.left) : rect.right + 10,
    top: below ? rect.bottom + 8 : rect.top + rect.height / 2,
    below,
  };
}

export function Sidebar({
  posts,
  remotePosts,
  tab,
  onTabChange,
  activePath,
  activeOrigin,
  ssh,
  sshConfigured,
  loadingRemote,
  remoteError,
  onOpen,
  onRename,
  onPublish,
  onDelete,
  onConnect,
  onOpenSettings,
  onResizeStart,
}: Props) {
  const [query, setQuery] = useState("");
  const [tip, setTip] = useState<Tip | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tipTimer = useRef(0);

  const visible = useMemo(() => {
    const source =
      tab === "posts" ? remotePosts : tab === "drafts" ? posts.filter((p) => p.folder === "drafts") : posts;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q),
    );
  }, [posts, remotePosts, query, tab]);

  const draftCount = posts.filter((p) => p.folder === "drafts").length;

  const hideTip = () => {
    window.clearTimeout(tipTimer.current);
    setTip(null);
  };

  const showTip = (el: HTMLElement, text: string) => {
    window.clearTimeout(tipTimer.current);
    const title = text.trim();
    if (!title) return;
    tipTimer.current = window.setTimeout(() => {
      setTip(tipFromEl(el, title));
    }, 280);
  };

  useEffect(() => () => window.clearTimeout(tipTimer.current), []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.addEventListener("scroll", hideTip, { passive: true });
    return () => list.removeEventListener("scroll", hideTip);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "posts" ? "搜索远程文章" : "搜索文章"}
        />
      </div>
      <div className="sidebar-tabs">
        <button className={tab === "all" ? "on" : ""} onClick={() => onTabChange("all")}>
          全部 {posts.length}
        </button>
        <button className={tab === "posts" ? "on" : ""} onClick={() => onTabChange("posts")}>
          已发布 {ssh.connected ? remotePosts.length : ""}
        </button>
        <button className={tab === "drafts" ? "on" : ""} onClick={() => onTabChange("drafts")}>
          草稿 {draftCount}
        </button>
      </div>
      <div className="post-list" ref={listRef}>
        {tab === "posts" && !sshConfigured && (
          <div className="muted-block">
            <p>配置 SSH 后可实时查看服务器已发布文章</p>
            <button type="button" className="text-btn" onClick={onOpenSettings}>
              去设置
            </button>
          </div>
        )}
        {tab === "posts" && sshConfigured && !ssh.connected && (
          <div className="muted-block">
            <p>连接服务器后，这里会列出远程 source/_posts</p>
            <button type="button" className="btn ghost" onClick={onConnect} disabled={ssh.busy}>
              <Plug size={14} />
              连接 SSH
            </button>
          </div>
        )}
        {tab === "posts" && ssh.connected && loadingRemote && visible.length === 0 && (
          <p className="muted-block">正在读取远程文章…</p>
        )}
        {tab === "posts" && ssh.connected && remoteError && visible.length === 0 && (
          <p className="muted-block">{remoteError}</p>
        )}
        {!(tab === "posts" && (!sshConfigured || !ssh.connected)) &&
          visible.length === 0 &&
          !loadingRemote &&
          !remoteError && <p className="muted-block">没有匹配的文章</p>}
        {visible.map((post) => {
          const active = activePath === post.path && activeOrigin === post.origin;
          return (
            <button
              key={`${post.origin}:${post.path}`}
              className={`post-item ${active ? "active" : ""}`}
              onClick={() => onOpen(post)}
              onMouseEnter={(e) => showTip(e.currentTarget, post.title)}
              onMouseLeave={hideTip}
            >
              {post.origin === "remote" ? <Cloud size={15} /> : <FileText size={15} />}
              <span className="post-item-body">
                <strong>{post.title}</strong>
                <small>
                  {post.origin === "remote" ? "远程 · " : post.folder === "drafts" ? "草稿 · " : ""}
                  {post.name}
                </small>
              </span>
              <span className="post-actions">
                {post.origin === "local" && post.folder === "drafts" ? (
                  <span
                    className="post-act"
                    title="发布到已发布（移到 source/_posts）"
                    onClick={(e) => {
                      e.stopPropagation();
                      hideTip();
                      onPublish(post);
                    }}
                  >
                    <Send size={13} />
                  </span>
                ) : null}
                <span
                  className="post-act"
                  title="修改文件名（文章链接）"
                  onClick={(e) => {
                    e.stopPropagation();
                    hideTip();
                    onRename(post);
                  }}
                >
                  <Pencil size={13} />
                </span>
                <span
                  className="post-act danger"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    hideTip();
                    onDelete(post);
                  }}
                >
                  <Trash2 size={13} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="sidebar-resizer"
        title="拖动调整宽度"
        onMouseDown={onResizeStart}
      />
      {tip
        ? createPortal(
            <div
              className={`post-title-tip${tip.below ? " below" : ""}`}
              style={{ left: tip.left, top: tip.top }}
              role="tooltip"
            >
              {tip.text}
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}
