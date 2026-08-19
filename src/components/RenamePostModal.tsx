import { useEffect, useMemo, useState } from "react";

type Target = {
  path: string;
  name: string;
};

type Props = {
  target: Target | null;
  onClose: () => void;
  onRename: (path: string, name: string) => Promise<void>;
};

function previewFilename(raw: string): { file: string; slug: string } {
  let name = raw.trim().replace(/\\/g, "/").split("/").pop() || "";
  name = name.replace(/\.md$/i, "");
  name = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.+$/g, "")
    .replace(/^-|-$/g, "");
  const file = name ? `${name}.md` : "";
  const dated = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return { file, slug: dated ? dated[2] : name };
}

export function RenamePostModal({ target, onClose, onRename }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name.replace(/\.md$/i, ""));
      setBusy(false);
    }
  }, [target]);

  const preview = useMemo(() => previewFilename(name), [name]);

  if (!target) return null;

  async function submit() {
    if (!preview.file || busy) return;
    setBusy(true);
    try {
      await onRename(target.path, preview.file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal compact" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>修改文件名</h2>
          <p>Hexo 默认用文件名作为文章链接。有日期前缀时，链接通常取前缀后面的部分。</p>
        </header>
        <label>
          新文件名
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="2024-08-19-hello-world"
          />
        </label>
        <p className="rename-preview">
          文件：<code>{preview.file || "—"}</code>
          <br />
          链接片段：<code>{preview.slug || "—"}</code>
        </p>
        <footer>
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => void submit()}
            disabled={busy || !preview.file}
          >
            {busy ? "保存中…" : "重命名"}
          </button>
        </footer>
      </div>
    </div>
  );
}
