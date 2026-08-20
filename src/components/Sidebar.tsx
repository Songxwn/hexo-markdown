import { Cloud, FileText, Pencil, Plug, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { PostOrigin, PostSummary, SshStatus } from "../lib/types";

export type SidebarTab = "all" | "posts" | "drafts";

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
  onDelete: (post: PostSummary) => void;
  onConnect: () => void;
  onOpenSettings: () => void;
};

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
  onDelete,
  onConnect,
  onOpenSettings,
}: Props) {
  const [query, setQuery] = useState("");

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
      <div className="post-list">
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
                <span
                  className="post-act"
                  title="修改文件名（文章链接）"
                  onClick={(e) => {
                    e.stopPropagation();
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
    </aside>
  );
}
