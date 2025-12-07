import React, { Profiler, useCallback, useEffect, useMemo, useRef, useOptimistic, useTransition } from "react"

import { CodeIcon, TypeIcon, FilePlus2Icon } from "lucide-react"

import { CodeEditor } from "@/components/editor/"
import type { CodeEditorHandle } from "@/components/editor/code-editor"
import { Button } from "@/components/ui/button"
import { FileInput } from "@/components/ui/knurl"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { cn } from "@/lib"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { warmPrettier } from "@/lib/prettier"
import { generateUniqueId } from "@/lib/utils"
import { useRequestBody, useRequestTab } from "@/state"
import { CodeLanguages, type FormField, type RequestBodyData, type RequestHeader, type RequestState } from "@/types"
import { EmptyState } from "./empty-state"
import { FormFieldList } from "./form-field-list"
import { SectionHeader } from "./section-header"

export function guessContentTypeByExt(name: string | undefined): string | undefined {
  if (!name) {
    return undefined
  }
  const ext = name.toLowerCase().split(".").pop() || ""
  switch (ext) {
    case "txt":
      return "text/plain"
    case "json":
      return "application/json"
    case "xml":
      return "application/xml"
    case "yaml":
    case "yml":
      return "application/yaml"
    case "csv":
      return "text/csv"
    case "html":
      return "text/html"
    case "css":
      return "text/css"
    case "js":
      return "application/javascript"
    case "ts":
      return "application/typescript"
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "gif":
      return "image/gif"
    case "webp":
      return "image/webp"
    case "svg":
      return "image/svg+xml"
    case "pdf":
      return "application/pdf"
    case "zip":
      return "application/zip"
    case "gz":
      return "application/gzip"
    case "tar":
      return "application/x-tar"
    case "tgz":
      return "application/gzip"
    default:
      return undefined
  }
}

export type RequestBodyPanelProps = {
  tabId: string
}

// Helper to determine the display label for the dropdown trigger
export const getBodyTypeLabel = (body: RequestBodyData): string => {
  switch (body.type) {
    case "none":
      return "None"
    case "binary":
      return "Binary File"
    case "form":
      return body.encoding === "multipart" ? "Form > Multipart" : "Form > URL-Encoded"
    case "text": {
      const lang = CodeLanguages.find((l) => l.language === body.language)
      return `Text > ${lang?.title ?? "Plain"}`
    }
    default:
      return "Select Body Type"
  }
}

function RequestBodyPanelComponent({ tabId }: RequestBodyPanelProps) {
  const {
    state: { body, original },
    actions,
  } = useRequestBody(tabId)
  const editorRef = useRef<CodeEditorHandle | null>(null)

  const [, startTransition] = useTransition()

  // Optimistic updates for instant feedback
  const [optimisticBody, updateBodyOptimistic] = useOptimistic(body, (state, changes: Record<string, unknown>) => ({
    ...state,
    ...changes,
  }))

  // Create a temporary request object for type checking functions
  const request = { body: optimisticBody } as RequestState

  // Access merged request to read user-provided headers for warnings
  const requestTab = useRequestTab(tabId)
  const mergedRequest = requestTab?.state.request

  const headerValue = useCallback(
    (name: string): string | undefined => {
      const headers: RequestHeader[] = mergedRequest?.headers
        ? (Object.values(mergedRequest.headers) as RequestHeader[])
        : []
      const found = headers.find((h) => h.enabled && h.name.toLowerCase() === name.toLowerCase())
      return found?.value
    },
    [mergedRequest],
  )

  const warnings: string[] = useMemo(() => {
    const list: string[] = []
    const ct = headerValue("Content-Type")?.toLowerCase()
    if (request.body.type === "form") {
      const enc = request.body.encoding ?? "url"
      const entries = Object.values(request.body.formData ?? {}) as FormField[]
      const hasFile = entries.some((f) => (f.kind ?? "text") === "file")
      if (enc !== "multipart" && hasFile) {
        list.push("Files require multipart/form-data. Change encoding to Multipart or switch to Binary Body.")
      }
      if (enc === "multipart" && ct && !ct.includes("multipart/form-data")) {
        list.push(
          "Content-Type header conflicts with Multipart encoding; backend will set a proper multipart boundary.",
        )
      }
    } else if (request.body.type === "binary") {
      if (ct && (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded"))) {
        list.push("Binary body conflicts with current Content-Type; consider removing or correcting the header.")
      }
    } else if (request.body.type === "text") {
      if (ct && (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded"))) {
        list.push("Text body conflicts with current Content-Type; consider removing or correcting the header.")
      }
    }
    return list
  }, [request.body, headerValue])

  useEffect(() => {
    if (body.type === "text") {
      const language = body.language ?? "text"
      if (language !== "text") {
        // Pre-warm prettier for the selected language to reduce first-format delay
        warmPrettier([language])
      }
    }
  }, [body.type, body.language])

  const addFormField = useCallback(
    (kind: "text" | "file") => {
      if (kind === "text") {
        actions.addFormItem()
        return
      }

      const id = generateUniqueId(8)
      actions.updateBody({ encoding: "multipart" })
      actions.updateFormItem(id, { id, key: "", value: "", enabled: true, secure: false, kind: "file" })
    },
    [actions],
  )

  return (
    <Profiler id="RequestBodyPanel" onRender={onProfilerRender}>
      <div className="flex flex-col gap-3 p-2 h-full overflow-y-auto min-h-0" data-test-id="request-body-panel">
        <div className="flex h-full min-h-0 flex-col gap-3">
          {warnings.length > 0 && (
            <div
              className="rounded-sm border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              data-test-id="request-body-panel:warnings"
            >
              {warnings.map((w) => (
                <div key={w}>• {w}</div>
              ))}
            </div>
          )}
          <SectionHeader
            title="Request Body"
            actions={
              body.type === "text" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={(body.language ?? "text") === "text"}
                  onClick={() => editorRef.current?.format()}
                  data-test-id="request-body-panel:format-button"
                >
                  <CodeIcon className="mr-1 h-4 w-4" />
                  Format
                </Button>
              ) : undefined
            }
          >
            <span className={cn("text-xs text-muted-foreground/80", isDirty(original, body) && "unsaved-changes")}>
              {getBodyTypeLabel(body)}
            </span>
          </SectionHeader>

          {request.body.type === "none" && <EmptyState message="This request does not have a body." height="tall" />}

          {request.body.type === "text" && (
            <div className="relative h-full min-h-0 flex-1 bg-card">
              <CodeEditor
                ref={editorRef}
                className={cn("h-full w-full", original.content !== optimisticBody.content && "unsaved-changes")}
                mode="edit"
                value={optimisticBody.content ?? ""}
                language={optimisticBody.language ?? "text"}
                onChange={(content) => {
                  startTransition(() => {
                    updateBodyOptimistic({ content })
                  })
                  actions.updateBodyContent(content)
                }}
                lineNumbers={(optimisticBody.content?.length ?? 0) > 0}
                placeholder="Enter request body (JSON, YAML, GraphQL, XML, etc.)"
                data-test-id="request-body-panel:text-editor"
              />
            </div>
          )}

          {request.body.type === "form" && (
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="flex items-center gap-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Form Fields</h4>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addFormField("text")}
                      data-test-id="request-body-panel:add-text-field-button"
                      className="h-6 px-2 gap-1"
                    >
                      <span className="text-xs">Text</span>
                      <TypeIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add Text Field</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addFormField("file")}
                      data-test-id="request-body-panel:add-file-field-button"
                      className="h-6 px-2 gap-1"
                    >
                      <span className="text-xs">File</span>
                      <FilePlus2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add File Field</TooltipContent>
                </Tooltip>
              </div>
              <section
                className="flex flex-col gap-3 divide-y divide-border/10"
                aria-label="Form fields dropzone"
                onDragOver={(e) => {
                  if (e.dataTransfer) {
                    e.preventDefault()
                  }
                }}
                onDrop={(e) => {
                  try {
                    e.preventDefault()
                    const uris = e.dataTransfer?.getData("text/uri-list") || ""
                    const paths = uris
                      .split(/\r?\n/)
                      .map((l) => l.trim())
                      .filter((l) => l.startsWith("file:"))
                      .map((u) => {
                        try {
                          const url = new URL(u)
                          let p = decodeURIComponent(url.pathname)
                          // Windows: strip leading '/'
                          if (/^\/[A-Za-z]:\//.test(p)) {
                            p = p.slice(1)
                          }
                          return p
                        } catch {
                          return ""
                        }
                      })
                      .filter(Boolean)
                    if (paths.length === 0) {
                      return
                    }
                    // Ensure multipart encoding
                    actions.updateBody({ encoding: "multipart" })
                    for (const p of paths) {
                      const id = generateUniqueId(8)
                      const name = p.split(/[/\\]/).pop() || "file"
                      const inferred = guessContentTypeByExt(name)
                      actions.updateFormItem(id, {
                        id,
                        key: name,
                        value: "",
                        enabled: true,
                        secure: false,
                        kind: "file",
                        fileName: name,
                        filePath: p,
                        contentType: inferred,
                      })
                    }
                  } catch {
                    // noop
                  }
              }}
                data-test-id="request-body-panel:form-section"
              >
                <FormFieldList
                  tabId={tabId}
                  formData={body.formData}
                  originalFormData={original?.formData}
                  onGuessContentType={guessContentTypeByExt}
                />
              </section>
            </div>
          )}

          {request.body.type === "binary" && (
            <div className="flex flex-col gap-3">
              <section
                className="mt-2"
                aria-label="Binary body dropzone"
                onDragOver={(e) => {
                  if (e.dataTransfer) {
                    e.preventDefault()
                  }
                }}
                onDrop={(e) => {
                  try {
                    e.preventDefault()
                    const uri = (e.dataTransfer?.getData("text/uri-list") || "")
                      .split(/\r?\n/)
                      .find((l) => l.startsWith("file:"))
                    if (!uri) {
                      return
                    }
                    const url = new URL(uri)
                    let p = decodeURIComponent(url.pathname)
                    if (/^\/[A-Za-z]:\//.test(p)) {
                      p = p.slice(1)
                    }
                    const name = p.split(/[/\\]/).pop() || "file"
                    const inferred = guessContentTypeByExt(name)
                    const next: Partial<RequestBodyData> = { binaryPath: p, binaryFileName: name }
                    if (inferred) {
                      next.binaryContentType = inferred
                    }
                    actions.updateBody(next)
                  } catch {
                    // noop
                  }
                }}
                data-test-id="request-body-panel:binary-section"
              >
                <FileInput
                  fileName={body.binaryFileName ?? ""}
                  contentType={body.binaryContentType ?? ""}
                  onFileChange={(path, name, mimeType) => {
                    const detected = mimeType ?? guessContentTypeByExt(name)
                    const next: Partial<RequestBodyData> = { binaryPath: path, binaryFileName: name }
                    if (detected) {
                      next.binaryContentType = detected
                    }
                    actions.updateBody(next)
                  }}
                  onContentTypeChange={(ct) => actions.updateBody({ binaryContentType: ct })}
                  onClear={() =>
                    actions.updateBody({
                      binaryPath: undefined,
                      binaryFileName: undefined,
                      binaryContentType: undefined,
                    })
                  }
                  data-test-id="request-body-panel:binary-file-input"
                />
              </section>
              {!body.binaryPath && <EmptyState message="No file selected." />}
            </div>
          )}
        </div>
      </div>
    </Profiler>
  )
}

export const RequestBodyPanel = React.memo(RequestBodyPanelComponent)

function isDirty(original: RequestBodyData, body: RequestBodyData) {
  return original.type !== body.type || original.encoding !== body.encoding || original.language !== body.language
}
