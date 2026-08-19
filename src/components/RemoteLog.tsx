import { useEffect, useRef } from "react";
import type { SshLogEvent } from "../lib/types";

type Props = {
  open: boolean;
  lines: SshLogEvent[];
  onClear: () => void;
};

export function RemoteLog({ open, lines, onClear }: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  if (!open) return null;

  return (
    <section className="remote-log">
      <header>
        <strong>远程日志</strong>
        <button type="button" onClick={onClear}>
          清空
        </button>
      </header>
      <div className="remote-log-body" ref={scroller}>
        {lines.length === 0 && <p className="muted-block">连接服务器后，SFTP 与 Hexo 命令输出会显示在这里。</p>}
        {lines.map((line, index) => (
          <pre key={`${line.ts}-${index}`} className={`log-${line.kind}`}>
            {line.text}
          </pre>
        ))}
      </div>
    </section>
  );
}
