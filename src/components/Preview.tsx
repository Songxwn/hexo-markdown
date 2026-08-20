import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { api } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";
import type { PostOrigin } from "../lib/types";

export type PreviewHandle = {
  scrollToHeading: (id: string) => void;
};

type Props = {
  markdown: string;
  postPath: string | null;
  origin?: PostOrigin;
  onActiveHeading?: (id: string | null) => void;
};

export const Preview = forwardRef<PreviewHandle, Props>(function Preview(
  { markdown, postPath, origin = "local", onActiveHeading },
  ref,
) {
  const articleRef = useRef<HTMLElement>(null);
  const html = useMemo(
    () => renderMarkdown(markdown, postPath, origin),
    [markdown, postPath, origin],
  );

  useImperativeHandle(ref, () => ({
    scrollToHeading(id: string) {
      const article = articleRef.current;
      if (!article || !id) return;
      const target = article.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.remove("heading-flash");
      void target.offsetWidth;
      target.classList.add("heading-flash");
      window.setTimeout(() => target.classList.remove("heading-flash"), 1200);
    },
  }));

  useEffect(() => {
    const article = articleRef.current;
    if (!article || !onActiveHeading) return;
    const nodes = [...article.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    if (!nodes.length) {
      onActiveHeading(null);
      return;
    }
    const root = article.closest(".preview-pane");
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.getAttribute("id");
        if (id) onActiveHeading(id);
      },
      { root, rootMargin: "-12px 0px -68% 0px", threshold: [0, 1] },
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, [html, onActiveHeading]);

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
      ref={articleRef}
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
});

Preview.displayName = "Preview";
