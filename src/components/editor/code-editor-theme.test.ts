import { describe, expect, it } from "vitest"
import { EditorView } from "@codemirror/view"

import { cmTheme } from "./code-editor-theme"

describe("cmTheme", () => {
  it("wraps CodeMirror extensions without throwing", () => {
    expect(Array.isArray(cmTheme)).toBe(true)
    expect(cmTheme).toHaveLength(2)

    const host = document.createElement("div")
    const view = new EditorView({
      doc: "const answer = 42",
      extensions: cmTheme,
      parent: host,
    })

    expect(host.querySelector(".cm-editor")).toBeTruthy()
    view.destroy()
  })
})
