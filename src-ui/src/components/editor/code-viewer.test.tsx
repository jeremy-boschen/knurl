import { render } from "@testing-library/react"
import { describe, expect, it, beforeEach, vi } from "vitest"

import { CodeViewer } from "./code-viewer"

type CodeEditorProps = Record<string, unknown>

const codeEditorMock = vi.fn((props: CodeEditorProps) => {
  return <div data-testid="code-editor-mock" data-value={props.value as string} />
})

vi.mock("./code-editor", () => ({
  CodeEditor: (props: CodeEditorProps) => codeEditorMock(props),
}))

describe("CodeViewer", () => {
  beforeEach(() => {
    codeEditorMock.mockClear()
    vi.clearAllMocks()
  })

  it("passes view mode props to CodeEditor", () => {
    render(
      <CodeViewer value="raw" language="json" className="foo" height="50%" placeholder="hint" />,
    )

    const props = codeEditorMock.mock.calls.at(-1)?.[0] as CodeEditorProps
    expect(props.mode).toBe("view")
    expect(props.lineNumbers).toBe(false)
    expect(props.onChange).toBeTypeOf("function")
    expect(props.value).toBe("raw")
    expect(props.className).toBe("foo")
    expect(props.height).toBe("50%")
    expect(props.placeholder).toBe("hint")
  })

  it("passes value through unchanged", () => {
    const { rerender } = render(<CodeViewer value="{}" language="json" />)

    let props = codeEditorMock.mock.calls.at(-1)?.[0] as CodeEditorProps
    expect(props.value).toBe("{}")

    rerender(<CodeViewer value="[]" language="json" />)
    props = codeEditorMock.mock.calls.at(-1)?.[0] as CodeEditorProps
    expect(props.value).toBe("[]")
  })

  it("respects syntaxHighlighting prop", () => {
    render(<CodeViewer value="raw" language="json" syntaxHighlighting={false} />)

    const props = codeEditorMock.mock.calls.at(-1)?.[0] as CodeEditorProps
    expect(props.syntaxHighlighting).toBe(false)
  })

  it("defaults syntaxHighlighting to true when not specified", () => {
    render(<CodeViewer value="raw" language="json" />)

    const props = codeEditorMock.mock.calls.at(-1)?.[0] as CodeEditorProps
    expect(props.syntaxHighlighting).toBe(true)
  })
})
