import { FileText, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { PostSummary } from "../lib/types";

type Props = {
  posts: PostSummary[];
  activePath: string | null;
  onOpen: (post: PostSummary) => void;
  onRename: (post: PostSummary) => void;
  onDelete: (post: PostSummary) => void;
};

export function Sidebar({ posts, activePath, onOpen, onRename, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "posts" | "drafts">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (tab !== "all" && p.folder !== tab) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q)
      );
    });
  }, [posts, query, tab]);

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文章"
        />
      </div>
      <div className="sidebar-tabs">
        <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>
          全部 {posts.length}
        </button>
        <button className={tab === "posts" ? "on" : ""} onClick={() => setTab("posts")}>
          已发布
        </button>
        <button className={tab === "drafts" ? "on" : ""} onClick={() => setTab("drafts")}>
          草稿
        </button>
      </div>
      <div className="post-list">
        {filtered.length === 0 && <p className="muted-block">没有匹配的文章</p>}
        {filtered.map((post) => (
          <button
            key={post.path}
            className={`post-item ${activePath === post.path ? "active" : ""}`}
            onClick={() => onOpen(post)}
          >
            <FileText size={15} />
            <span className="post-item-body">
              <strong>{post.title}</strong>
              <small>
                {post.folder === "drafts" ? "草稿 · " : ""}
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
        ))}
      </div>
    </aside>
  );
}
