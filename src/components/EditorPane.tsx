import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { inkHighlighting, inkTheme } from "../lib/cm-theme";

export type EditorScrollPos = {
  line: number;
  totalLines: number;
  atStart: boolean;
  atEnd: boolean;
};

export type EditorHandle = {
  wrapSelection: (before: string, after?: string) => void;
  insertAtCursor: (text: string) => void;
  replaceText: (from: string, to: string) => boolean;
  getSelection: () => { text: string; from: number; to: number };
  replaceSelection: (text: string) => void;
  setDocument: (text: string) => void;
  gotoLine: (line: number) => void;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPasteImage: (file: File) => void;
  onScroll?: (pos: EditorScrollPos) => void;
};

function readScrollPos(view: EditorView): EditorScrollPos {
  const scroller = view.scrollDOM;
  const totalLines = view.state.doc.lines;
  const max = scroller.scrollHeight - scroller.clientHeight;
  const atStart = scroller.scrollTop <= 1;
  const atEnd = max > 0 && scroller.scrollTop >= max - 2;
  if (atStart) return { line: 0, totalLines, atStart: true, atEnd: false };
  if (atEnd) return { line: Math.max(totalLines - 1, 0), totalLines, atStart: false, atEnd: true };

  const rect = scroller.getBoundingClientRect();
  const pos = view.posAtCoords({ x: rect.left + 56, y: rect.top + 10 });
  if (pos == null) {
    const ratio = max > 0 ? scroller.scrollTop / max : 0;
    return { line: ratio * Math.max(totalLines - 1, 0), totalLines, atStart: false, atEnd: false };
  }
  const line = view.state.doc.lineAt(pos);
  const start = view.coordsAtPos(line.from);
  const end = view.coordsAtPos(Math.min(line.to, line.from + 1));
  let frac = 0;
  if (start && end && end.bottom > start.top) {
    frac = (rect.top + 10 - start.top) / (end.bottom - start.top);
    frac = Math.min(0.99, Math.max(0, frac));
  }
  return {
    line: line.number - 1 + frac,
    totalLines,
    atStart: false,
    atEnd: false,
  };
}

function wakeEditor(view: EditorView, shouldFocus = false): void {
  const dom = view.contentDOM;
  if (dom.getAttribute("contenteditable") !== "true") {
    dom.setAttribute("contenteditable", "true");
  }
  if (dom.tabIndex < 0) {
    dom.tabIndex = 0;
  }
  view.requestMeasure();
  if (shouldFocus) view.focus();
}

function canTakeEditorFocus(): boolean {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return true;
  if (el.closest(".modal-backdrop, .llm-panel")) return false;
  if (el.closest("input, textarea, select")) return false;
  return true;
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(gif|png|jpe?g|webp|svg|bmp|avif)$/i.test(file.name);
}

function preferOriginalImages(files: File[]): File[] {
  const seen = new Set<string>();
  const unique: File[] = [];
  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(file);
  }
  const native = unique.filter(
    (file) =>
      /gif|webp|avif/i.test(file.type) || /\.(gif|webp|avif)$/i.test(file.name),
  );
  if (!native.length) return unique;
  return unique.filter((file) => {
    const clipboardPng =
      file.type === "image/png" && (!file.name || /^image\.png$/i.test(file.name));
    return !clipboardPng;
  });
}

function collectImages(data: DataTransfer | null): File[] {
  if (!data) return [];
  const named = Array.from(data.files || []).filter(isImageFile);
  const fromFiles = named.filter((file) => file.name && !/^image\.(png|jpe?g)$/i.test(file.name));
  if (fromFiles.length) return preferOriginalImages(fromFiles);

  const fromItems: File[] = [];
  for (const item of Array.from(data.items || [])) {
    if (item.kind !== "file") continue;
    if (item.type && !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) fromItems.push(file);
  }
  return preferOriginalImages(fromItems.length ? fromItems : named);
}

export const EditorPane = forwardRef<EditorHandle, Props>(function EditorPane(
  { value, onChange, onPasteImage, onScroll },
  ref,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onPasteRef = useRef(onPasteImage);
  const onScrollRef = useRef(onScroll);
  onChangeRef.current = onChange;
  onPasteRef.current = onPasteImage;
  onScrollRef.current = onScroll;

  useImperativeHandle(ref, () => ({
    wrapSelection(before, after = before) {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      const selected = view.state.sliceDoc(sel.from, sel.to);
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: before + selected + after },
        selection: {
          anchor: sel.from + before.length,
          head: sel.from + before.length + selected.length,
        },
      });
      view.focus();
    },
    insertAtCursor(text) {
      const view = viewRef.current;
      if (!view) return;
      const pos = view.state.selection.main.from;
      view.dispatch({
        changes: { from: pos, insert: text },
        selection: { anchor: pos + text.length },
      });
      view.focus();
    },
    replaceText(from, to) {
      const view = viewRef.current;
      if (!view) return false;
      const doc = view.state.doc.toString();
      const index = doc.indexOf(from);
      if (index < 0) return false;
      view.dispatch({
        changes: { from: index, to: index + from.length, insert: to },
      });
      return true;
    },
    getSelection() {
      const view = viewRef.current;
      if (!view) return { text: "", from: 0, to: 0 };
      const sel = view.state.selection.main;
      return { text: view.state.sliceDoc(sel.from, sel.to), from: sel.from, to: sel.to };
    },
    replaceSelection(text) {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: { anchor: sel.from + text.length },
      });
      view.focus();
    },
    setDocument(text) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
      view.focus();
    },
    gotoLine(line) {
      const view = viewRef.current;
      if (!view) return;
      const safe = Math.min(Math.max(1, line + 1), view.state.doc.lines);
      const pos = view.state.doc.line(safe).from;
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
      view.focus();
    },
    focus() {
      const view = viewRef.current;
      if (view) wakeEditor(view, true);
    },
  }));

  useEffect(() => {
    if (!parentRef.current) return;

    const pasteHandler = EditorView.domEventHandlers({
      paste(event) {
        const files = collectImages(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        const view = viewRef.current;
        if (view) files.forEach((file) => onPasteRef.current(file));
        return true;
      },
      drop(event, view) {
        const files = collectImages(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos != null) {
          view.dispatch({ selection: { anchor: pos } });
        }
        files.forEach((file) => onPasteRef.current(file));
        return true;
      },
      dragover(event) {
        if (event.dataTransfer?.types.includes("Files")) {
          event.preventDefault();
        }
      },
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        minimalSetup,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        markdown({ codeLanguages: languages }),
        inkTheme,
        inkHighlighting,
        EditorView.lineWrapping,
        placeholder("写点什么，或从别处粘贴一张图片……"),
        keymap.of([indentWithTab]),
        pasteHandler,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.docChanged || update.geometryChanged) {
            onScrollRef.current?.(readScrollPos(update.view));
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: parentRef.current });
    viewRef.current = view;
    const onScrollerScroll = () => onScrollRef.current?.(readScrollPos(view));
    view.scrollDOM.addEventListener("scroll", onScrollerScroll, { passive: true });
    const host = parentRef.current;
    const resize = new ResizeObserver(() => {
      if (viewRef.current === view) wakeEditor(view);
    });
    resize.observe(host);
    const onWindowFocus = () => {
      if (viewRef.current === view && canTakeEditorFocus()) wakeEditor(view, true);
    };
    window.addEventListener("focus", onWindowFocus);
    const wake = () => {
      if (viewRef.current !== view) return;
      wakeEditor(view, canTakeEditorFocus());
      onScrollRef.current?.(readScrollPos(view));
    };
    queueMicrotask(wake);
    let innerRaf = 0;
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(wake);
    });
    return () => {
      window.cancelAnimationFrame(outerRaf);
      window.cancelAnimationFrame(innerRaf);
      window.removeEventListener("focus", onWindowFocus);
      resize.disconnect();
      view.scrollDOM.removeEventListener("scroll", onScrollerScroll);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: 0 },
    });
    view.scrollDOM.scrollTop = 0;
    onScrollRef.current?.(readScrollPos(view));
    window.requestAnimationFrame(() => {
      if (viewRef.current === view) wakeEditor(view, canTakeEditorFocus());
    });
  }, [value]);

  return (
    <div
      className="editor-host"
      ref={parentRef}
      onMouseDown={(event) => {
        const view = viewRef.current;
        if (!view) return;
        if (event.target === view.scrollDOM) return;
        view.focus();
      }}
    />
  );
});

EditorPane.displayName = "EditorPane";
