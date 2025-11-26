import { Upload, XIcon } from "lucide-react"
import { useEffect, useRef, type DragEventHandler } from "react"
import type React from "react"
import type { Input } from "./input"
import { openFile } from "@/bindings/knurl"
import { getCurrentWebview } from "@tauri-apps/api/webview"

type Props = Omit<React.ComponentProps<typeof Input>, "ref"> & {
  /** Optional identifier (not used for native input anymore). */
  name?: string
  /** Displayed file name (read-only). */
  fileName: string
  /** MIME type value shown in the content-type input. */
  contentType: string
  /** Called when a file is chosen (via dialog or drop). */
  onFileChange: (filePath: string, fileName: string, mimeType?: string) => void
  /** Called when user edits the content-type field. */
  onContentTypeChange: (type: string) => void
  /** Handler to clear the selected file. */
  onClear: () => void
}
export function FileInput({ name: _name, fileName, contentType, onFileChange, onContentTypeChange, onClear }: Props) {
  const dropZoneRef = useRef<HTMLFieldSetElement | null>(null)
  const dropHandledRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI__" in window)) {
      return
    }

    let isMounted = true
    let unlisten: (() => void) | undefined

    const attach = async () => {
      try {
        const webview = getCurrentWebview()
        unlisten = await webview.onDragDropEvent((event) => {
          if (!isMounted) {
            return
          }

          const payload = event.payload
          if (payload.type !== "drop" || !payload.paths.length) {
            return
          }

          const target = dropZoneRef.current
          if (!target) {
            return
          }

          const rect = target.getBoundingClientRect()
          const scale = window.devicePixelRatio || 1
          const logicalX = payload.position.x / scale
          const logicalY = payload.position.y / scale
          const withinX = logicalX >= rect.left && logicalX <= rect.right
          const withinY = logicalY >= rect.top && logicalY <= rect.bottom

          if (!withinX || !withinY) {
            return
          }

          dropHandledRef.current = true
          const path = payload.paths[0]
          const name = path.split(/[/\\]/).pop() || "file"
          onFileChange(path, name)
        })
      } catch {
        // no-op: drag and drop events are unavailable outside Tauri runtime
      }
    }

    void attach()

    return () => {
      isMounted = false
      if (unlisten) {
        unlisten()
      }
    }
  }, [onFileChange])

  const handleChooseFile = async () => {
    const chosen = await openFile({ title: "Choose File", readContent: false })
    if (!chosen || !chosen.filePath) {
      return
    }
    const path = chosen.filePath
    const name = path.split(/[/\\]/).pop() || "file"
    onFileChange(path, name, chosen.mimeType)
    if (chosen.mimeType) {
      onContentTypeChange(chosen.mimeType)
    }
  }

  const handleDrop: DragEventHandler<HTMLFieldSetElement> = (e) => {
    try {
      e.preventDefault()
      if (dropHandledRef.current) {
        dropHandledRef.current = false
        return
      }
      const uris = e.dataTransfer?.getData("text/uri-list") || ""
      const uri = uris.split(/\r?\n/).find((l) => l.startsWith("file:"))
      if (!uri) {
        return
      }
      const url = new URL(uri)
      let p = decodeURIComponent(url.pathname)
      // Windows: strip leading '/'
      if (/^\/[A-Za-z]:\//.test(p)) {
        p = p.slice(1)
      }
      const name = p.split(/[/\\]/).pop() || "file"
      onFileChange(p, name)
    } catch {
      // noop
    }
  }

  const handleDragOver: DragEventHandler<HTMLFieldSetElement> = (e) => {
    if (e.dataTransfer) {
      e.preventDefault()
    }
  }

  const handleClear = () => {
    onClear()
    onContentTypeChange("")
  }

  const containerClass =
    "grid grid-cols-[minmax(0,6fr)_2rem_2rem_1px_minmax(0,6fr)] items-center gap-x-0 bg-zinc-800 border border-zinc-700 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-zinc-600 p-0 m-0"

  return (
    <fieldset className={containerClass} ref={dropZoneRef} onDragOver={handleDragOver} onDrop={handleDrop}>
      <legend className="sr-only">File input dropzone</legend>
      <input
        type="text"
        value={fileName}
        readOnly
        placeholder="No file selected"
        className="min-w-0 bg-transparent px-3 py-2 text-sm text-white border-none outline-none placeholder:text-zinc-500"
      />

      <button
        type="button"
        onClick={handleChooseFile}
        className="flex h-full items-center justify-center text-white hover:bg-zinc-700 transition-colors"
        title="Choose file"
        aria-label="Choose file"
      >
        <Upload className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={handleClear}
        className="flex h-full items-center justify-center text-white hover:bg-zinc-700 transition-colors disabled:pointer-events-none disabled:opacity-50 border-l border-l-zinc-700/60"
        title="Clear file"
        aria-label="Clear file"
        disabled={!fileName}
      >
        <XIcon className="w-4 h-4" />
      </button>

      <div className="h-6 w-full bg-zinc-700" aria-hidden="true"></div>

      <input
        type="text"
        value={contentType}
        onChange={(e) => onContentTypeChange(e.target.value)}
        placeholder="content-type"
        className="min-w-0 bg-transparent px-3 py-2 text-sm text-white border-none outline-none placeholder:text-zinc-500"
      />
    </fieldset>
  )
}
