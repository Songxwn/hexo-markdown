import { api } from "../lib/api";

const REPO_URL = "https://github.com/Songxwn/hexo-markdown";

type Props = {
  open: boolean;
  name: string;
  version: string;
  electron: string;
  chrome: string;
  onClose: () => void;
};

export function AboutModal({ open, name, version, electron, chrome, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal compact about-modal" onClick={(e) => e.stopPropagation()}>
        <span className="mark about-mark" aria-hidden />
        <header>
          <h2>{name || "Hexo Markdown"}</h2>
          <p>跨平台 Hexo Markdown 编辑器</p>
        </header>
        <p className="about-version">版本 {version || "—"}</p>
        <p className="about-repo">
          <button
            type="button"
            className="about-link"
            onClick={() => void api.openExternal(REPO_URL)}
          >
            {REPO_URL}
          </button>
        </p>
        <p className="about-meta">
          Electron {electron || "—"}
          <br />
          Chromium {chrome || "—"}
        </p>
        <footer>
          <button className="btn primary" type="button" onClick={onClose} autoFocus>
            确定
          </button>
        </footer>
      </div>
    </div>
  );
}
