import type { SshLogKind } from "./types";

type LogFn = (kind: SshLogKind, text: string) => void;

let sink: LogFn = () => undefined;

export function setActivityLog(fn: LogFn): void {
  sink = fn;
}

export function emitLog(kind: SshLogKind, text: string): void {
  const lines = String(text).split(/\r?\n/);
  for (const line of lines) {
    if (line.length) sink(kind, line);
  }
}
