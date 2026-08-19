import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const inkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "14.5px",
      backgroundColor: "transparent",
      color: "#e6e1d6",
    },
    ".cm-scroller": {
      fontFamily: '"IBM Plex Mono", "Sarasa Gothic SC", "Noto Sans SC", ui-monospace, monospace',
      lineHeight: "1.7",
    },
    ".cm-content": {
      caretColor: "#d4a574",
      padding: "20px 22px 48px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#d4a574",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(212, 165, 116, 0.28)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.035)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#5c5a55",
      border: "none",
      fontSize: "12px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#d4a574",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 12px 0 8px",
    },
    ".cm-panels": {
      backgroundColor: "#16130f",
      color: "#e6e1d6",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(212, 165, 116, 0.35)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(212, 165, 116, 0.55)",
    },
    ".cm-foldPlaceholder": {
      background: "#2a261f",
      border: "none",
      color: "#9a9488",
    },
  },
  { dark: true },
);

const inkHighlight = HighlightStyle.define([
  { tag: t.heading, color: "#f3ead8", fontWeight: "700" },
  { tag: t.heading1, color: "#f7f1e4" },
  { tag: t.heading2, color: "#efe6d4" },
  { tag: t.strong, color: "#f0d9b5", fontWeight: "700" },
  { tag: t.emphasis, color: "#e6e1d6", fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#c9a27a" },
  { tag: t.url, color: "#8fa8c4" },
  { tag: t.monospace, color: "#c9d4b8" },
  { tag: t.quote, color: "#9a9488", fontStyle: "italic" },
  { tag: t.meta, color: "#7d776c" },
  { tag: t.comment, color: "#6f6a62", fontStyle: "italic" },
  { tag: t.keyword, color: "#c9a27a" },
  { tag: t.string, color: "#b7c9a3" },
  { tag: t.number, color: "#d4b48c" },
  { tag: t.bool, color: "#d4b48c" },
  { tag: t.atom, color: "#c9a27a" },
  { tag: t.variableName, color: "#e6e1d6" },
  { tag: t.processingInstruction, color: "#7d776c" },
  { tag: t.punctuation, color: "#8a847a" },
]);

export const inkHighlighting = syntaxHighlighting(inkHighlight);
