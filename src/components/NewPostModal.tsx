import { useEffect, useMemo, useState } from "react";
import { slugifyFilename } from "../lib/markdown";
import type { PostFolder, PostTemplate, TemplateSet } from "../lib/types";

type Props = {
  open: boolean;
  templates: TemplateSet | null;
  remote?: boolean;
  defaultFolder?: PostFolder;
  onClose: () => void;
  onCreate: (title: string, folder: PostFolder, templateId: string) => Promise<void>;
};

function allTemplates(set: TemplateSet | null): PostTemplate[] {
  if (!set) return [];
  return [...set.items, ...set.scaffolds];
}

export function NewPostModal({ open, templates, remote = false, defaultFolder = "posts", onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<PostFolder>("posts");
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => allTemplates(templates), [templates]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setFolder(remote ? "posts" : defaultFolder);
      setTemplateId(templates?.defaultId || options[0]?.id || "");
      setBusy(false);
    }
  }, [open, options, templates?.defaultId, remote, defaultFolder]);

  if (!open) return null;

  const filename = slugifyFilename(title || "未命名");
  const dir = folder === "drafts" ? "source/_drafts" : "source/_posts";

  async function submit() {
    setBusy(true);
    try {
      await onCreate(title.trim() || "未命名", folder, templateId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal compact" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>新建文章</h2>
          <p>
            {remote
              ? "会直接写到远程服务器的 source/_posts。文件名不含日期，日期写在文章头。"
              : "会写入 Hexo 的 source/_posts 或 source/_drafts。文件名不含日期，日期写在文章头。"}
          </p>
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
        {options.length > 0 ? (
          <label>
            模板
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.id === templates?.defaultId ? "（默认）" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {remote ? (
          <p className="rename-preview">目标：远程服务器</p>
        ) : (
          <div className="choice-row">
            <button type="button" className={folder === "posts" ? "on" : ""} onClick={() => setFolder("posts")}>
              已发布
            </button>
            <button type="button" className={folder === "drafts" ? "on" : ""} onClick={() => setFolder("drafts")}>
              草稿
            </button>
          </div>
        )}
        <p className="rename-preview">
          文件：<code>{dir}/{filename}</code>
        </p>
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
