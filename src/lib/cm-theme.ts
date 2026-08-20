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
      color: "var(--cm-fg)",
    },
    ".cm-scroller": {
      fontFamily: editorFont,
      lineHeight: "1.78",
      fontVariantLigatures: "contextual",
    },
    ".cm-content": {
      caretColor: "var(--cm-caret)",
      padding: "22px 26px 64px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--cm-caret)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--cm-selection)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--cm-active-line)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--cm-gutter)",
      border: "none",
      fontSize: "11.5px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--cm-caret)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 14px 0 10px",
      minWidth: "2.4em",
    },
    ".cm-placeholder": {
      color: "var(--cm-placeholder)",
      fontStyle: "italic",
    },
    ".cm-panels": {
      backgroundColor: "var(--cm-panel)",
      color: "var(--cm-fg)",
    },
    ".cm-searchMatch": {
      backgroundColor: "var(--cm-search)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "var(--cm-search-on)",
    },
    ".cm-foldPlaceholder": {
      background: "var(--cm-fold)",
      border: "none",
      color: "var(--cm-fold-fg)",
    },
  },
  { dark: true },
);

const inkHighlight = HighlightStyle.define([
  { tag: t.heading, color: "var(--cm-heading)", fontWeight: "700" },
  { tag: t.heading1, color: "var(--cm-heading-1)" },
  { tag: t.heading2, color: "var(--cm-heading-2)" },
  { tag: t.strong, color: "var(--cm-strong)", fontWeight: "700" },
  { tag: t.emphasis, color: "var(--cm-fg)", fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--cm-link)" },
  { tag: t.url, color: "var(--cm-url)" },
  { tag: t.monospace, color: "var(--cm-mono)" },
  { tag: t.quote, color: "var(--cm-quote)", fontStyle: "italic" },
  { tag: t.meta, color: "var(--cm-meta)" },
  { tag: t.comment, color: "var(--cm-comment)", fontStyle: "italic" },
  { tag: t.keyword, color: "var(--cm-keyword)" },
  { tag: t.string, color: "var(--cm-string)" },
  { tag: t.number, color: "var(--cm-number)" },
  { tag: t.bool, color: "var(--cm-number)" },
  { tag: t.atom, color: "var(--cm-keyword)" },
  { tag: t.variableName, color: "var(--cm-variable)" },
  { tag: t.processingInstruction, color: "var(--cm-meta)" },
  { tag: t.punctuation, color: "var(--cm-punct)" },
]);

export const inkHighlighting = syntaxHighlighting(inkHighlight);
