import { useEffect, useState } from "react";
import type { PostFolder } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, folder: PostFolder) => Promise<void>;
};

export function NewPostModal({ open, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<PostFolder>("posts");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setFolder("posts");
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    try {
      await onCreate(title.trim() || "未命名", folder);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal compact" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>新建文章</h2>
          <p>会写入 Hexo 的 source/_posts 或 source/_drafts</p>
        </header>
        <label>
          标题
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="文章标题"
          />
        </label>
        <div className="choice-row">
          <button type="button" className={folder === "posts" ? "on" : ""} onClick={() => setFolder("posts")}>
            已发布
          </button>
          <button type="button" className={folder === "drafts" ? "on" : ""} onClick={() => setFolder("drafts")}>
            草稿
          </button>
        </div>
        <footer>
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn primary" type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? "创建中…" : "创建"}
          </button>
        </footer>
      </div>
    </div>
  );
}
