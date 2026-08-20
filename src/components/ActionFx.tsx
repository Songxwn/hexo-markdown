import { useEffect, useMemo, type CSSProperties } from "react";

export type ActionFxKind = "save" | "deploy";

export type ActionFxState = {
  kind: ActionFxKind;
  x: number;
  y: number;
  key: number;
};

type Spec = { id: number; dx: number; dy: number; delay: number; size: number };

function burst(kind: ActionFxKind): Spec[] {
  const count = kind === "deploy" ? 20 : 16;
  return Array.from({ length: count }, (_, id) => {
    const upward = kind === "deploy";
    const angle = upward ? -Math.PI / 2 + (Math.random() - 0.5) * 1.55 : (id / count) * Math.PI * 2 + Math.random() * 0.45;
    const dist = (upward ? 42 : 28) + Math.random() * (upward ? 64 : 46);
    return {
      id,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      delay: Math.random() * 90,
      size: 2.5 + Math.random() * 4.5,
    };
  });
}

export function originFrom(el: HTMLElement | null): { x: number; y: number } | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

type Props = {
  fx: ActionFxState | null;
  onDone: () => void;
};

export function ActionFx({ fx, onDone }: Props) {
  const specs = useMemo(() => (fx ? burst(fx.kind) : []), [fx]);

  useEffect(() => {
    if (!fx) return;
    const id = window.setTimeout(onDone, 980);
    return () => window.clearTimeout(id);
  }, [fx, onDone]);

  if (!fx) return null;

  return (
    <div className={`action-fx action-fx-${fx.kind}`} style={{ left: fx.x, top: fx.y }} aria-hidden>
      <span className="action-fx-ring" />
      <span className="action-fx-bloom" />
      {specs.map((spec) => (
        <span
          key={spec.id}
          className="action-fx-dot"
          style={
            {
              "--dx": `${spec.dx}px`,
              "--dy": `${spec.dy}px`,
              "--delay": `${spec.delay}ms`,
              width: spec.size,
              height: spec.size,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
