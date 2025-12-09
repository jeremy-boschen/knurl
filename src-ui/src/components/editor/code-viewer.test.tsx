import { render, waitFor } from "@testing-library/react"
import { describe, expect, it, beforeEach, vi } from "vitest"

import { CodeViewer } from "./code-viewer"
import { formatWithPrettier } from "@/lib/prettier"

type CodeEditorProps = Record<string, unknown>

const codeEditorMock = vi.fn((props: CodeEditorProps) => {
  return <div data-testid="code-editor-mock" data-value={props.value as string} />
})

vi.mock("./code-editor", () => ({
  CodeEditor: (props: CodeEditorProps) => codeEditorMock(props),
}))

vi.mock("@/lib/prettier", () => ({
  formatWithPrettier: vi.fn(async (value: string, language: string) => `${language}::${value}::formatted`),
}))

describe("CodeViewer", () => {
  beforeEach(() => {
    codeEditorMock.mockClear()
    vi.clearAllMocks()
  })

  it("passes view mode props to CodeEditor", () => {
    render(
      <CodeViewer value="raw" language="json" formatted={false} className="foo" height="50%" placeholder="hint" />,
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

  it("formats value when formatted flag becomes true and caches by key", async () => {
    const mockedPrettier = vi.mocked(formatWithPrettier)
    const formatted = (value: string, language: string) => `${language}::${value}::fmt`
    mockedPrettier.mockImplementation(async (value, language) => formatted(value, language))

    const { rerender } = render(<CodeViewer value="{}" language="json" formatted={false} />)

    const beforeFormatCalls = mockedPrettier.mock.calls.length
    rerender(<CodeViewer value="{}" language="json" formatted={true} />)

    await waitFor(() => expect(mockedPrettier.mock.calls.length).toBeGreaterThan(beforeFormatCalls))
    await waitFor(() => expect(codeEditorMock.mock.calls.at(-1)?.[0].value).toBe(formatted("{}", "json")))
    const afterFirstFormat = mockedPrettier.mock.calls.length

    rerender(<CodeViewer value="{}" language="json" formatted={true} />)
    await Promise.resolve()
    expect(mockedPrettier.mock.calls.length).toBe(afterFirstFormat)

    rerender(<CodeViewer value="[]" language="json" formatted={true} />)
    await waitFor(() => expect(mockedPrettier.mock.calls.length).toBeGreaterThan(afterFirstFormat))
    await waitFor(() => expect(codeEditorMock.mock.calls.at(-1)?.[0].value).toBe(formatted("[]", "json")))
    const afterSecondFormat = mockedPrettier.mock.calls.length

    rerender(<CodeViewer value="[]" language="yaml" formatted={true} />)
    await waitFor(() => expect(mockedPrettier.mock.calls.length).toBeGreaterThan(afterSecondFormat))
    await waitFor(() => expect(codeEditorMock.mock.calls.at(-1)?.[0].value).toBe(formatted("[]", "yaml")))
  })

  it("respects syntaxHighlighting prop", () => {
    render(<CodeViewer value="raw" language="json" formatted={false} syntaxHighlighting={false} />)

    const props = codeEditorMock.mock.calls.at(-1)?.[0] as CodeEditorProps
    expect(props.syntaxHighlighting).toBe(false)
  })

  it("defaults syntaxHighlighting to true when not specified", () => {
    render(<CodeViewer value="raw" language="json" formatted={false} />)

    const props = codeEditorMock.mock.calls.at(-1)?.[0] as CodeEditorProps
    expect(props.syntaxHighlighting).toBe(true)
  })
})
