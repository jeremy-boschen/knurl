import { useEffect, useMemo, useRef, useState } from "react"

import type { CodeLanguage } from "@/types"
import { formatWithPrettier } from "@/lib/prettier"
import { CodeEditor } from "./code-editor"

/** Controlled: parent owns `formatted` */
type CodeViewerProps = {
  value: string
  language: CodeLanguage
  formatted: boolean
  className?: string
  height?: string
  placeholder?: string
}

const noop = () => {}

export function CodeViewer({ value, language, formatted, className, height = "100%", placeholder }: CodeViewerProps) {
  // cache formatted result per (language,value)
  const [cache, setCache] = useState<{ key: string; out: string } | null>(null)
  const formatSequence = useRef(0)
  const key = useMemo(() => `${language}::${value}`, [language, value])

  useEffect(() => {
    setCache((prev) => (prev?.key === key ? prev : null)) // only clear if stale
    formatSequence.current++ // cancel in-flight format
  }, [key])

  // format on demand when parent sets formatted=true
  useEffect(() => {
    if (!formatted) {
      return
    }
    if (cache && cache.key === key) {
      return
    }
    const id = ++formatSequence.current
    ;(async () => {
      const out = await formatWithPrettier(value, language)
      if (id !== formatSequence.current) {
        return // stale
      }
      setCache({ key, out })
    })()
  }, [formatted, key, language, value, cache])

  // derived: show raw until formatted is ready
  const displayValue = formatted ? (cache && cache.key === key ? cache.out : value) : value

  return (
    <CodeEditor
      className={className}
      height={height}
      value={displayValue}
      language={language}
      mode="view"
      placeholder={placeholder}
      onChange={noop}
      lineNumbers={false}
    />
  )
}
