import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { EditorScrollPos } from "./EditorPane";
import { api } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";
import type { PostOrigin } from "../lib/types";

export type PreviewHandle = {
  scrollToHeading: (id: string) => void;
  scrollToSourceLine: (pos: EditorScrollPos) => void;
};

type Props = {
  markdown: string;
  postPath: string | null;
  origin?: PostOrigin;
  onActiveHeading?: (id: string | null) => void;
  onRender?: () => void;
};

function interpolateY(anchors: { line: number; y: number }[], line: number): number {
  if (!anchors.length) return 0;
  if (line <= anchors[0].line) return anchors[0].y;
  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i];
    const to = anchors[i + 1];
    if (line > to.line) continue;
    const span = to.line - from.line;
    if (span <= 0) return to.y;
    const t = (line - from.line) / span;
    return from.y + t * (to.y - from.y);
  }
  return anchors[anchors.length - 1].y;
}

function collectAnchors(pane: HTMLElement, article: HTMLElement, totalLines: number) {
  const paneRect = pane.getBoundingClientRect();
  const anchors: { line: number; y: number }[] = [{ line: 0, y: 0 }];
  for (const node of article.querySelectorAll<HTMLElement>("[data-line]")) {
    const line = Number(node.dataset.line);
    if (!Number.isFinite(line)) continue;
    const y = node.getBoundingClientRect().top - paneRect.top + pane.scrollTop;
    anchors.push({ line, y });
  }
  const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
  anchors.push({ line: Math.max(totalLines - 1, 0), y: max });
  anchors.sort((a, b) => a.line - b.line || a.y - b.y);
  const dedup: { line: number; y: number }[] = [];
  for (const anchor of anchors) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.line === anchor.line) {
      prev.y = (prev.y + anchor.y) / 2;
      continue;
    }
    dedup.push({ ...anchor });
  }
  return dedup;
}

export const Preview = forwardRef<PreviewHandle, Props>(function Preview(
  { markdown, postPath, origin = "local", onActiveHeading, onRender },
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
    scrollToSourceLine(pos) {
      const article = articleRef.current;
      const pane = article?.closest(".preview-pane") as HTMLElement | null;
      if (!article || !pane) return;
      const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
      if (pos.atStart || max <= 0) {
        pane.scrollTop = 0;
        return;
      }
      if (pos.atEnd) {
        pane.scrollTop = max;
        return;
      }
      const y = interpolateY(collectAnchors(pane, article, pos.totalLines), pos.line);
      pane.scrollTop = Math.min(max, Math.max(0, y));
    },
  }));

  useEffect(() => {
    onRender?.();
  }, [html, onRender]);

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
