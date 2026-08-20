import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const editorFont =
  '"JetBrains Mono", "IBM Plex Mono", "Cascadia Code", "Sarasa Gothic SC", "Noto Sans SC", ui-monospace, monospace';

export const inkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "15px",
      backgroundColor: "transparent",
      color: "#f1ebe0",
    },
    ".cm-scroller": {
      fontFamily: editorFont,
      lineHeight: "1.78",
      fontVariantLigatures: "contextual",
    },
    ".cm-content": {
      caretColor: "#d7ab78",
      padding: "22px 26px 64px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#d7ab78",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(215, 171, 120, 0.28)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 248, 236, 0.035)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#6a6358",
      border: "none",
      fontSize: "11.5px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#d7ab78",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 14px 0 10px",
      minWidth: "2.4em",
    },
    ".cm-placeholder": {
      color: "#6a6358",
      fontStyle: "italic",
    },
    ".cm-panels": {
      backgroundColor: "#16130f",
      color: "#f1ebe0",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(215, 171, 120, 0.35)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(215, 171, 120, 0.55)",
    },
    ".cm-foldPlaceholder": {
      background: "#2a261f",
      border: "none",
      color: "#9a9284",
    },
  },
  { dark: true },
);

const inkHighlight = HighlightStyle.define([
  { tag: t.heading, color: "#f7f1e6", fontWeight: "700" },
  { tag: t.heading1, color: "#fff8ee" },
  { tag: t.heading2, color: "#f4ecde" },
  { tag: t.strong, color: "#f3d7b0", fontWeight: "700" },
  { tag: t.emphasis, color: "#f1ebe0", fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#d7ab78" },
  { tag: t.url, color: "#8fa8c4" },
  { tag: t.monospace, color: "#c9d4b8" },
  { tag: t.quote, color: "#9a9284", fontStyle: "italic" },
  { tag: t.meta, color: "#7d776c" },
  { tag: t.comment, color: "#6f6a62", fontStyle: "italic" },
  { tag: t.keyword, color: "#d7ab78" },
  { tag: t.string, color: "#b7c9a3" },
  { tag: t.number, color: "#e0b98a" },
  { tag: t.bool, color: "#e0b98a" },
  { tag: t.atom, color: "#d7ab78" },
  { tag: t.variableName, color: "#f1ebe0" },
  { tag: t.processingInstruction, color: "#7d776c" },
  { tag: t.punctuation, color: "#8a847a" },
]);

export const inkHighlighting = syntaxHighlighting(inkHighlight);
