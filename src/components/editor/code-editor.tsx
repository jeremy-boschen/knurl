import type React from "react"
import { useImperativeHandle, useMemo, useRef } from "react"

import CodeMirror, { type ReactCodeMirrorProps } from "@uiw/react-codemirror"
import { bracketMatching } from "@codemirror/language"
import { EditorState, type Extension } from "@codemirror/state"
import { EditorView, highlightActiveLine, placeholder as placeholderExt } from "@codemirror/view"
import { css as cmCss } from "@codemirror/lang-css"
import { html as cmHtml } from "@codemirror/lang-html"
import { javascript as cmJavascript } from "@codemirror/lang-javascript"
import { json as cmJson } from "@codemirror/lang-json"
import { xml as cmXml } from "@codemirror/lang-xml"
import { yaml as cmYaml } from "@codemirror/lang-yaml"
import { graphql as cmGraphql } from "cm6-graphql"
import { cmTheme } from "@/components/editor/code-editor-theme"
import { useEvent } from "@/hooks/use-event"
import { formatWithPrettier } from "@/lib/prettier"
import type { CodeLanguage } from "@/types"

type Mode = "edit" | "view"

export type CodeEditorHandle = { format: () => void }

type Props = {
  ref?: React.Ref<CodeEditorHandle>
  value: string
  onChange: (value: string) => void
  language: CodeLanguage
  mode?: Mode
  height?: string
  minHeight?: string
  className?: string
  extraExtensions?: Extension[]
  lineNumbers?: boolean
  placeholder?: string
  readOnly?: boolean
}

export function CodeEditor({
  ref,
  value,
  onChange,
  language,
  mode = "edit",
  height = "100%",
  minHeight,
  className,
  extraExtensions = [],
  lineNumbers = false,
  placeholder,
  readOnly = false,
}: Props) {
  const latestValueRef = useRef(value)
  latestValueRef.current = value

  const baseExtensions = useMemo<Extension[]>(
    () => [
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      bracketMatching(),
      mode === "edit" ? highlightActiveLine() : [],
      mode === "view" ? EditorView.editable.of(false) : [],
    ],
    [mode],
  )

  // Get language extension directly without lazy loading
  const langExt = useMemo(() => {
    switch (language) {
      case "json":
        return cmJson()
      case "yaml":
        return cmYaml()
      case "xml":
        return cmXml()
      case "html":
        return cmHtml()
      case "graphql":
        return cmGraphql()
      case "javascript":
        return cmJavascript()
      case "css":
        return cmCss()
      default:
        return null
    }
  }, [language])

  // destructive format: overwrite value via onChange
  const doFormat = useEvent(async () => {
    const current = latestValueRef.current
    const out = await formatWithPrettier(current, language)
    if (out !== current) {
      onChange(out)
    }
  })

  useImperativeHandle(ref, () => ({ format: doFormat }), [doFormat])

  const basicSetup = useMemo(
    () => ({
      lineNumbers,
      foldGutter: false,
      highlightActiveLine: mode === "edit",
      highlightActiveLineGutter: false,
      history: false,
      bracketMatching: false,
      autocompletion: false,
      highlightSelectionMatches: false,
      defaultKeymap: false,
      searchKeymap: false,
      historyKeymap: false,
      foldKeymap: false,
      completionKeymap: false,
      lintKeymap: false,
      syntaxHighlighting: true,
    }),
    [lineNumbers, mode],
  )

  const extensions = useMemo(() => {
    const exts: Extension[] = [...baseExtensions]
    if (langExt) {
      exts.push(langExt)
    }
    if (placeholder) {
      exts.push(placeholderExt(placeholder))
    }
    exts.push(...extraExtensions)
    return exts
  }, [baseExtensions, langExt, extraExtensions, placeholder])

  const props: ReactCodeMirrorProps = {
    className: className,
    value: value,
    height: height,
    editable: mode === "edit",
    basicSetup: basicSetup,
    extensions: extensions,
    onChange: onChange,
    theme: cmTheme,
    readOnly: readOnly,
  }

  if (minHeight) {
    props.minHeight = minHeight
  }

  return <CodeMirror {...props} />
}
