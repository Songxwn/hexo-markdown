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

function collectImages(list: FileList | DataTransferItemList | null): File[] {
  if (!list) return [];
  const files: File[] = [];
  if (list instanceof FileList) {
    for (const file of Array.from(list)) {
      if (file.type.startsWith("image/")) files.push(file);
    }
    return files;
  }
  for (const item of Array.from(list)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
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
      viewRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (!parentRef.current) return;

    const pasteHandler = EditorView.domEventHandlers({
      paste(event) {
        const files = collectImages(event.clipboardData?.items || null);
        if (!files.length) return false;
        event.preventDefault();
        const view = viewRef.current;
        if (view) files.forEach((file) => onPasteRef.current(file));
        return true;
      },
      drop(event, view) {
        const files = collectImages(event.dataTransfer?.files || null);
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
    queueMicrotask(() => onScrollRef.current?.(readScrollPos(view)));
    return () => {
      view.scrollDOM.removeEventListener("scroll", onScrollerScroll);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
      view.scrollDOM.scrollTop = 0;
      onScrollRef.current?.(readScrollPos(view));
    }
  }, [value]);

  return <div className="editor-host" ref={parentRef} />;
});

EditorPane.displayName = "EditorPane";
