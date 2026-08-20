import { ListTree } from "lucide-react";
import { useEffect, useRef } from "react";
import type { MdHeading } from "../lib/markdown";

type Props = {
  headings: MdHeading[];
  activeId: string | null;
  onSelect: (heading: MdHeading) => void;
};

export function Outline({ headings, activeId, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(".outline-item.active");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <aside className="outline" aria-label="文章大纲">
      <div className="outline-head">
        <ListTree size={14} />
        <span>大纲</span>
        {headings.length > 0 ? <em>{headings.length}</em> : null}
      </div>
      <div className="outline-list" ref={listRef}>
        {headings.length === 0 ? (
          <p className="outline-empty">
            没有标题
            <small>用 # / ## / ### 写出层级</small>
          </p>
        ) : (
          headings.map((heading) => (
            <button
              key={`${heading.from}-${heading.id}`}
              type="button"
              className={`outline-item level-${heading.level}${activeId === heading.id ? " active" : ""}`}
              style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
              title={heading.text}
              onClick={() => onSelect(heading)}
            >
              <span className="outline-lv">H{heading.level}</span>
              <span className="outline-text">{heading.text}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
