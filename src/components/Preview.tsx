import { useMemo } from "react";
import { api } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";

type Props = {
  markdown: string;
  postPath: string | null;
};

export function Preview({ markdown, postPath }: Props) {
  const html = useMemo(() => renderMarkdown(markdown, postPath), [markdown, postPath]);

  if (!markdown.trim()) {
    return (
      <div className="preview-empty">
        <p>预览会出现在这里</p>
        <span>支持 GFM、代码高亮，以及常见 Hexo 标签</span>
      </div>
    );
  }

  return (
    <article
      className="preview-article"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (!anchor?.href) return;
        if (/^https?:/i.test(anchor.href)) {
          event.preventDefault();
          void api.openExternal(anchor.href);
        }
      }}
    />
  );
}
