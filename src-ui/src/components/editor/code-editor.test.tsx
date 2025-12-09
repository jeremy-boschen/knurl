import { createRef } from "react"

import { render, act } from "@testing-library/react"
import { describe, expect, it, beforeEach, vi } from "vitest"
import type { Mock } from "vitest"

import type { CodeEditorHandle } from "./code-editor"
import { CodeEditor } from "./code-editor"
import { formatWithPrettier } from "@/lib/prettier"

const codeMirrorRender = vi.hoisted(() => vi.fn((props: Record<string, unknown>) => null)) as Mock<
  [Record<string, unknown>],
  null
>

const createLanguageExt = vi.hoisted(() => (label: string) => () => ({ type: label })) as (
  label: string,
) => () => { type: string }

vi.mock("@uiw/react-codemirror", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => codeMirrorRender(props),
}))

vi.mock("@codemirror/lang-json", () => ({ json: createLanguageExt("json") }))
vi.mock("@codemirror/lang-yaml", () => ({ yaml: createLanguageExt("yaml") }))
vi.mock("@codemirror/lang-xml", () => ({ xml: createLanguageExt("xml") }))
vi.mock("@codemirror/lang-html", () => ({ html: createLanguageExt("html") }))
vi.mock("cm6-graphql", () => ({ graphql: createLanguageExt("graphql") }))
vi.mock("@codemirror/lang-javascript", () => ({ javascript: createLanguageExt("javascript") }))
vi.mock("@codemirror/lang-css", () => ({ css: createLanguageExt("css") }))

vi.mock("@codemirror/state", () => ({
  EditorState: { tabSize: { of: (value: number) => ({ type: "tabSize", value }) } },
}))

vi.mock("@codemirror/view", () => ({
  EditorView: {
    lineWrapping: { type: "lineWrapping" },
    editable: { of: (flag: boolean) => ({ type: "editable", flag }) },
  },
  highlightActiveLine: () => ({ type: "highlightActiveLine" }),
  placeholder: (text: string) => ({ type: "placeholder", text }),
}))

vi.mock("@codemirror/language", () => ({
  bracketMatching: () => ({ type: "bracketMatching" }),
}))

vi.mock("@/components/editor/code-editor-theme", () => ({ cmTheme: "mock-theme" }))

vi.mock("@/lib/prettier", () => ({
  formatWithPrettier: vi.fn(async (value: string) => value),
}))

const getLastRenderProps = () => codeMirrorRender.mock.calls.at(-1)?.[0] as Record<string, unknown>

describe("CodeEditor", () => {
  beforeEach(() => {
    codeMirrorRender.mockClear()
    vi.clearAllMocks()
  })

  it("renders editable CodeMirror by default", () => {
    const handleChange = vi.fn()
    render(<CodeEditor value="{}" language="json" onChange={handleChange} />)

    const props = getLastRenderProps()
    expect(props.value).toBe("{}")
    expect(props.height).toBe("100%")
    expect(props.editable).toBe(true)
    expect(props.readOnly).toBe(false)
    expect(props.basicSetup).toEqual(
      expect.objectContaining({ lineNumbers: false, highlightActiveLine: true }),
    )
    expect(props.theme).toBe("mock-theme")
  })

  it("applies view mode, readOnly, minHeight, and placeholder extensions", () => {
    render(
      <CodeEditor
        value="value"
        language="json"
        onChange={vi.fn()}
        mode="view"
        minHeight="200px"
        placeholder="Paste here"
        lineNumbers
        readOnly
        extraExtensions={[{ type: "extra" }]}
      />,
    )

    const props = getLastRenderProps()
    expect(props.editable).toBe(false)
    expect(props.readOnly).toBe(true)
    expect(props.minHeight).toBe("200px")
    expect(props.basicSetup).toEqual(
      expect.objectContaining({ lineNumbers: true, highlightActiveLine: false }),
    )

    const extensions = props.extensions as Array<{ type?: string }>
    const extensionNames = extensions
      .filter((ext) => Boolean(ext?.type))
      .map((ext) => ext.type as string)
    expect(extensionNames).toEqual(
      expect.arrayContaining(["placeholder", "extra", "lineWrapping", "bracketMatching"]),
    )
  })

  it("includes language-specific extension when available", () => {
    render(<CodeEditor value="foo" language="yaml" onChange={vi.fn()} />)
    let extensions = (getLastRenderProps().extensions || []) as Array<{ type?: string }>
    expect(extensions).toEqual(expect.arrayContaining([{ type: "yaml" }]))

    render(<CodeEditor value="foo" language="text" onChange={vi.fn()} />)
    extensions = (getLastRenderProps().extensions || []) as Array<{ type?: string }>
    expect(extensions.some((ext) => ext?.type === "yaml")).toBe(false)
  })

  it("exposes imperative format handle that calls prettier when output differs", async () => {
    const ref = createRef<CodeEditorHandle>()
    const onChange = vi.fn()
    vi.mocked(formatWithPrettier).mockResolvedValueOnce("formatted")
    render(<CodeEditor ref={ref} value="raw" language="json" onChange={onChange} />)

    await act(async () => {
      await ref.current?.format()
    })

    expect(formatWithPrettier).toHaveBeenCalledWith("raw", "json")
    expect(onChange).toHaveBeenCalledWith("formatted")
  })

  it("skips onChange when prettier returns identical value", async () => {
    const ref = createRef<CodeEditorHandle>()
    const onChange = vi.fn()
    vi.mocked(formatWithPrettier).mockResolvedValueOnce("same")
    render(<CodeEditor ref={ref} value="same" language="json" onChange={onChange} />)

    await act(async () => {
      await ref.current?.format()
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it("disables language extension when syntaxHighlighting is false", () => {
    const handleChange = vi.fn()
    render(<CodeEditor value="{}" language="json" onChange={handleChange} syntaxHighlighting={false} />)

    const extensions = (getLastRenderProps().extensions || []) as Array<{ type?: string }>
    // Language extension should not be included
    expect(extensions.some((ext) => ext?.type === "json")).toBe(false)
  })

  it("includes language extension when syntaxHighlighting is true", () => {
    const handleChange = vi.fn()
    render(<CodeEditor value="{}" language="json" onChange={handleChange} syntaxHighlighting={true} />)

    const extensions = (getLastRenderProps().extensions || []) as Array<{ type?: string }>
    // Language extension should be included
    expect(extensions.some((ext) => ext?.type === "json")).toBe(true)
  })

  it("includes language extension by default when syntaxHighlighting is not specified", () => {
    const handleChange = vi.fn()
    render(<CodeEditor value="{}" language="json" onChange={handleChange} />)

    const extensions = (getLastRenderProps().extensions || []) as Array<{ type?: string }>
    // Language extension should be included by default
    expect(extensions.some((ext) => ext?.type === "json")).toBe(true)
  })
})
