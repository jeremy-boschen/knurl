import type { CodeLanguage } from "@/types"
import { CodeEditor } from "./code-editor"

/** Controlled: parent owns `formatted` and `displayValue` */
type CodeViewerProps = {
  value: string
  language: CodeLanguage
  className?: string
  height?: string
  placeholder?: string
  syntaxHighlighting?: boolean
}

const noop = () => {}

export function CodeViewer({
  value,
  language,
  className,
  height = "100%",
  placeholder,
  syntaxHighlighting = true,
}: CodeViewerProps) {
  return (
    <CodeEditor
      className={className}
      height={height}
      value={value}
      language={language}
      mode="view"
      placeholder={placeholder}
      onChange={noop}
      lineNumbers={false}
      syntaxHighlighting={syntaxHighlighting}
      data-test-id="code-viewer"
    />
  )
}
