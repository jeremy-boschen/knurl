import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"
import { createTheme } from "@uiw/codemirror-themes"

const cmKnurlBaseTheme = createTheme({
  // Let CSS variables drive the final colors; pick light defaults so CodeMirror doesn't invert anything.
  theme: "light",
  settings: {
    background: "var(--background)",
    foreground: "var(--foreground)",
    caret: "var(--primary)",
    selection: "color-mix(in oklch, var(--primary) 22%, transparent)",
    selectionMatch: "color-mix(in oklch, var(--primary) 22%, transparent)",
    lineHighlight: "color-mix(in oklch, var(--accent) 12%, transparent)",
    gutterBackground: "var(--background)",
    gutterForeground: "var(--muted-foreground)",
    gutterActiveForeground: "var(--foreground)",
    gutterBorder: "var(--border)",
    fontFamily:
      "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace)",
    fontSize: "12.5px",
  },
  styles: [
    { tag: [t.keyword, t.modifier, t.operatorKeyword], color: "var(--primary)" },
    { tag: [t.string, t.special(t.string)], color: "var(--chart-3)" },
    { tag: [t.number, t.bool, t.null], color: "var(--chart-5)" },
    { tag: [t.regexp], color: "var(--chart-2)" },
    { tag: [t.name, t.variableName], color: "var(--foreground)" },
    { tag: [t.propertyName, t.attributeName], color: "var(--chart-4)" },
    { tag: [t.function(t.variableName), t.function(t.name)], color: "var(--chart-1)" },
    { tag: [t.className, t.typeName, t.tagName], color: "var(--accent)" },
    { tag: [t.comment], color: "var(--muted-foreground)", fontStyle: "italic" },
    { tag: [t.punctuation, t.squareBracket, t.paren], color: "var(--muted-foreground)" },
    { tag: [t.heading], color: "var(--primary)" },
    { tag: [t.meta], color: "var(--muted-foreground)" },
  ],
})

const cmKnurlExtras = EditorView.theme(
  {
    ".cm-gutters": {
      borderRight: "1px solid var(--border)",
    },
    ".cm-scroller": {
      lineHeight: "1.45",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--primary)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": { borderTopColor: "var(--border)" },
    ".cm-tooltip .cm-tooltip-arrow:after": { borderTopColor: "var(--popover)" },
    ".cm-panels": {
      backgroundColor: "var(--card)",
      color: "var(--card-foreground)",
      borderTop: "1px solid var(--border)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px",
    },
  },
  {
    /* don't force dark/light; CSS vars handle it */
  },
)

export const cmTheme: Extension = [cmKnurlBaseTheme, cmKnurlExtras]
