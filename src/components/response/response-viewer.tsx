import React, { useState } from "react"

import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener"
import { CodeIcon, CopyIcon, ExternalLinkIcon, FolderOpenIcon, ListRestartIcon } from "lucide-react"

import { saveBinary, saveFile } from "@/bindings/knurl"
import { CodeViewer } from "@/components/editor/code-viewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEvent } from "@/hooks/use-event"
import { warmPrettier } from "@/lib/prettier"
import { cn, isNotEmpty } from "@/lib/utils"
import { useRequestTab } from "@/state"
import { type CodeLanguage, CodeLanguages, DEFAULT_LOG_LEVELS, type ResponseState } from "@/types"
import { CookieList, HeadersList, LogsList } from "./components"

const detectLanguage = (contentType: string | undefined, body?: string): CodeLanguage => {
  const type = (contentType ?? "").toLowerCase()

  // Structured suffixes
  if (/\+json($|;)/.test(type) || type.includes("application/json") || type.includes("text/json")) {
    return "json"
  }
  if (/\+xml($|;)/.test(type) || type.includes("application/xml") || type.includes("text/xml")) {
    return "xml"
  }
  if (type.includes("text/html") || type.includes("application/xhtml")) {
    return "html"
  }
  if (type.includes("application/javascript") || type.includes("text/javascript")) {
    return "javascript"
  }
  if (type.includes("text/css")) {
    return "css"
  }
  if (type.includes("application/x-yaml") || type.includes("text/yaml") || type.includes("text/x-yaml")) {
    return "yaml"
  }

  // Fallback sniffing
  const sample = (body ?? "").trim().slice(0, 1000)
  if (!sample) {
    return "text"
  }
  if (sample.startsWith("{") || sample.startsWith("[")) {
    try {
      JSON.parse(sample)
      return "json"
    } catch {
      // ignore
    }
  }
  if (/^<\?xml|<([a-zA-Z!]|!--)/.test(sample)) {
    return "xml"
  }
  if (/^\s*\w+\s*\{[\s\S]*\}/.test(sample) && /:\s*[^;]+;/.test(sample)) {
    return "css"
  }
  if (/function\s|=>|const\s|let\s|class\s/.test(sample)) {
    return "javascript"
  }
  return "text"
}

export type RequestTabsProps = {
  tabId: string
  className: string
}

export default function ResponseViewer({ tabId, className }: RequestTabsProps) {
  const requestTab = useRequestTab(tabId)
  const [responseLanguage, setResponseLanguage] = useState<CodeLanguage>("text")
  const [activeResponseTab, setActiveResponseTab] = useState("response-body")
  const [formattedView, setFormattedView] = useState<boolean>(false)

  const activeTab = requestTab?.state.activeTab
  const request = requestTab?.state.request
  const requestTabsApi = requestTab?.actions.requestTabsApi

  const response = activeTab?.response as ResponseState | undefined

  // Extract the HTTP-specific data if the response is of type http
  const httpResponse = response?.data?.type === "http" ? response.data.data : null
  const contentType = httpResponse?.headers?.["content-type"] || httpResponse?.headers?.["Content-Type"]
  const ct = (contentType ?? "").toLowerCase()
  const isImage = ct.startsWith("image/")
  const isPdf = ct.includes("application/pdf")
  const isCsv = ct.includes("text/csv") || ct.includes("application/csv")
  const isAudio = ct.startsWith("audio/")
  const isVideo = ct.startsWith("video/")
  const isOctet = ct.includes("application/octet-stream")
  const isBinary = isImage || isPdf || isAudio || isVideo || isOctet
  const isPreviewable = isImage || isPdf || isCsv || isAudio || isVideo

  const toggleFormatted = useEvent(() => {
    setFormattedView((prev) => !prev)
  })

  // Auto-detect language when response changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only changes on response.id
  React.useEffect(() => {
    if (httpResponse?.headers) {
      const contentType = httpResponse.headers["content-type"] || httpResponse.headers["Content-Type"]
      const detectedLang = detectLanguage(contentType, httpResponse.body)
      setResponseLanguage(detectedLang)
    } else {
      setResponseLanguage("text")
    }
  }, [response?.requestId])

  // Pre-warm prettier for current language to reduce first-format delay
  React.useEffect(() => {
    if (responseLanguage !== "text") {
      warmPrettier([responseLanguage])
    }
  }, [responseLanguage])

  if (!requestTab || !activeTab || !request || !requestTabsApi) {
    return null
  }

  const getEmptyStateMessage = () => {
    if (!activeTab) {
      return {
        title: "No Response Yet",
        subtitle: "Send a request to see the response here",
      }
    }

    const hasUrl = request.url?.length > 0

    if (!hasUrl) {
      return {
        title: "Ready to Send",
        subtitle: "Enter a URL above and click Send to get started",
      }
    } else if (hasUrl && !response) {
      return {
        title: "Ready to Send",
        subtitle: "Click the Send button to execute your request",
      }
    } else {
      return {
        title: "No Response Yet",
        subtitle: "Send a request to see the response here",
      }
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) {
      return "text-green-500"
    }
    if (status >= 300 && status < 400) {
      return "text-blue-500"
    }
    if (status >= 400 && status < 500) {
      return "text-warning"
    }
    if (status >= 500) {
      return "text-red-500"
    }
    return "text-gray-500"
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return "0 B"
    }
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  const handleLanguageChange = (lang: string) => {
    if (formattedView) {
      setFormattedView(false)
    }
    setResponseLanguage(lang as CodeLanguage)
  }

  if (!response) {
    return null
  }

  return (
    <div className={cn("flex flex-col h-full w-full", className)}>
      {isNotEmpty(response) ? (
        <Tabs
          value={activeResponseTab}
          onValueChange={setActiveResponseTab}
          className="flex flex-1 flex-col overflow-auto gap-0"
        >
          <div className="sticky top-0 z-20 bg-muted">
            <div className="flex items-center justify-between border-b px-2">
              <TabsList className="h-10 p-0 rounded-none space-x-2">
                <h2 className="text-lg font-medium mr-2 text-foreground">Response</h2>
                <TabsTrigger value="response-body" className="knurl-tab group/tab">
                  Body
                </TabsTrigger>
                {isPreviewable && (
                  <TabsTrigger value="response-preview" className="knurl-tab group/tab">
                    Preview
                  </TabsTrigger>
                )}
                <TabsTrigger value="response-headers" className="knurl-tab group/tab">
                  Headers
                  <Badge
                    variant="outline"
                    className={cn(
                      "group-data-[state=inactive]/tab:text-muted-foreground",
                      "ml-1 rounded px-1.5 py-0.5 text-xs",
                    )}
                  >
                    {Object.keys(httpResponse?.headers ?? {}).length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="response-cookies" className="knurl-tab group/tab">
                  Cookies
                  <Badge
                    variant="outline"
                    className={cn(
                      "group-data-[state=inactive]/tab:text-muted-foreground",
                      "ml-1 rounded px-1.5 py-0.5 text-xs",
                    )}
                  >
                    {Object.keys(httpResponse?.cookies ?? {}).length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="response-logs" className="knurl-tab group/tab">
                  Logs
                  <Badge
                    variant="outline"
                    className={cn(
                      "group-data-[state=inactive]/tab:text-muted-foreground",
                      "ml-1 rounded px-1.5 py-0.5 text-xs",
                    )}
                  >
                    {response.logs?.length ?? 0}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              {httpResponse && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={cn("font-mono font-medium", getStatusColor(httpResponse.status ?? -1))}>
                      {httpResponse.status} {httpResponse.statusText}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-mono text-muted-foreground/75">{response.responseTime}ms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="font-mono text-muted-foreground/75">
                      {formatBytes(response.responseSize ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          const cd =
                            httpResponse?.headers?.["content-disposition"] ||
                            httpResponse?.headers?.["Content-Disposition"]
                          const fnameMatch = cd?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/)
                          const inferredName = fnameMatch?.[1] || fnameMatch?.[2]
                          const defaultExt = (() => {
                            if (ct.startsWith("image/")) {
                              return ct.split("/")[1] || "bin"
                            }
                            if (ct.includes("pdf")) {
                              return "pdf"
                            }
                            if (ct.includes("csv")) {
                              return "csv"
                            }
                            if (ct.includes("json")) {
                              return "json"
                            }
                            if (ct.includes("xml")) {
                              return "xml"
                            }
                            if (ct.includes("yaml")) {
                              return "yml"
                            }
                            if (ct.startsWith("audio/")) {
                              return ct.split("/")[1] || "audio"
                            }
                            if (ct.startsWith("video/")) {
                              return ct.split("/")[1] || "video"
                            }
                            return "txt"
                          })()
                          const defaultPath = inferredName ? inferredName : `response.${defaultExt}`

                          // For text-like, save raw body; for binary-like, save base64 with .b64 when bodyBase64 present
                          if ((isImage || isPdf || isAudio || isVideo) && httpResponse?.bodyBase64) {
                            await saveBinary(httpResponse.bodyBase64, {
                              title: "Save Response",
                              defaultPath: defaultPath,
                            })
                          } else {
                            await saveFile(httpResponse?.body ?? "", {
                              title: "Save Response",
                              defaultPath: defaultPath,
                            })
                          }
                        } catch (_e) {
                          // ignore; user may have cancelled
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="response-body" className="m-0 h-full">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between bg-background/80 backdrop-blur-sm py-3 px-4 sticky top-0 z-20 border-b border-border/10">
                  <div className="flex items-center space-x-3">
                    {isBinary ? (
                      <Badge variant="outline">Base64</Badge>
                    ) : (
                      <>
                        <Select value={responseLanguage} onValueChange={handleLanguageChange}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CodeLanguages.map((lang) => (
                              <SelectItem key={lang.language} value={lang.language}>
                                {lang.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={responseLanguage === "text"}
                          onClick={toggleFormatted}
                          className="text-muted-foreground"
                        >
                          {formattedView ? (
                            <>
                              <ListRestartIcon className="mr-1 h-4 w-4" /> Restore
                            </>
                          ) : (
                            <>
                              <CodeIcon className="mr-1 h-4 w-4" /> Format
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(isBinary ? httpResponse?.bodyBase64 || "" : httpResponse?.body || "")
                    }
                    className="text-muted-foreground"
                  >
                    <CopyIcon className="mr-1 h-4 w-4" />
                    Copy
                  </Button>
                </div>
                {httpResponse?.filePath ? (
                  <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground">
                    {(() => {
                      const f = httpResponse?.filePath
                      return (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => f && openPath(f)}
                            title="Open saved response file"
                          >
                            <ExternalLinkIcon className="mr-1 h-3.5 w-3.5" /> Open
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => f && revealItemInDir(f)}
                            title="Reveal in file manager"
                          >
                            <FolderOpenIcon className="mr-1 h-3.5 w-3.5" /> Reveal
                          </Button>
                        </>
                      )
                    })()}
                  </div>
                ) : null}
                <div className="flex-1 overflow-auto p-4 pt-0">
                  {isBinary ? (
                    httpResponse?.bodyBase64 ? (
                      <div className="h-full w-full font-mono text-sm whitespace-pre-wrap break-all select-text">
                        {httpResponse.bodyBase64}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Binary body; preview disabled due to size.</div>
                    )
                  ) : (
                    <CodeViewer
                      className="h-full w-full"
                      height="100%"
                      value={httpResponse?.body ?? ""}
                      language={responseLanguage as CodeLanguage}
                      formatted={formattedView}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {isPreviewable && (
              <TabsContent value="response-preview" className="m-0 h-full p-4">
                {httpResponse?.filePath ? (
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {(() => {
                      const f = httpResponse?.filePath
                      return (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => f && openPath(f)}
                            title="Open saved response file"
                          >
                            <ExternalLinkIcon className="mr-1 h-3.5 w-3.5" /> Open
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => f && revealItemInDir(f)}
                            title="Reveal in file manager"
                          >
                            <FolderOpenIcon className="mr-1 h-3.5 w-3.5" /> Reveal
                          </Button>
                        </>
                      )
                    })()}
                  </div>
                ) : null}
                {isImage && httpResponse?.bodyBase64 ? (
                  <div className="flex h-full items-center justify-center">
                    <img
                      alt="Response"
                      className="max-w-full max-h-full object-contain"
                      src={`data:${contentType};base64,${httpResponse.bodyBase64}`}
                    />
                  </div>
                ) : isPdf && httpResponse?.bodyBase64 ? (
                  <iframe
                    title="PDF preview"
                    className="h-full w-full rounded border"
                    src={`data:application/pdf;base64,${httpResponse.bodyBase64}`}
                  />
                ) : isPdf && !httpResponse?.bodyBase64 ? (
                  <div className="text-sm text-muted-foreground">Preview disabled for large PDFs.</div>
                ) : isCsv ? (
                  <CsvPreview csv={httpResponse?.body ?? ""} />
                ) : isAudio && httpResponse?.bodyBase64 ? (
                  <audio controls className="w-full">
                    <source src={`data:${contentType};base64,${httpResponse.bodyBase64}`} />
                    <track kind="captions" srcLang="en" label="captions" />
                  </audio>
                ) : isVideo && httpResponse?.bodyBase64 ? (
                  <video controls className="w-full max-h-full">
                    <source src={`data:${contentType};base64,${httpResponse.bodyBase64}`} />
                    <track kind="captions" srcLang="en" label="captions" />
                  </video>
                ) : (isAudio || isVideo) && !httpResponse?.bodyBase64 ? (
                  <div className="text-sm text-muted-foreground">Preview disabled for large media files.</div>
                ) : (
                  <div className="text-sm text-muted-foreground">No preview available.</div>
                )}
              </TabsContent>
            )}

            <TabsContent value="response-headers" className="m-0 h-full p-4">
              <HeadersList headers={httpResponse?.headers ?? {}} />
            </TabsContent>

            <TabsContent value="response-cookies" className="m-0 h-full p-4">
              <div className="flex h-full flex-col">
                {httpResponse?.cookies && httpResponse.cookies.length > 0 ? (
                  <CookieList tabId={tabId} cookies={httpResponse.cookies} />
                ) : (
                  <div className="flex flex-1 items-center justify-center py-4">
                    <div className="text-center text-muted-foreground">
                      <div className="mb-2 text-4xl">🍪</div>
                      <div className="text-lg font-medium">No Cookies</div>
                      <div className="text-sm">Response cookies will appear here</div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="response-logs" className="m-0 h-full p-4">
              <LogsList
                logs={response?.logs ?? []}
                sending={activeTab?.sending}
                selectedLevels={response.logFilterLevels ?? DEFAULT_LOG_LEVELS}
                onSelectedLevelsChange={(levels) => requestTabsApi.setResponseLogFilter(tabId, levels)}
              />
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="mb-4 text-6xl">{getEmptyStateMessage().icon}</div>
            <div className="mb-2 text-lg font-medium">{getEmptyStateMessage().title}</div>
            <div className="text-sm">{getEmptyStateMessage().subtitle}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function CsvPreview({ csv }: { csv: string }) {
  const rows = React.useMemo(() => parseCsv(csv), [csv])
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-muted-foreground">Empty CSV</div>
  }
  const header = rows[0]
  const data = rows.slice(1)
  return (
    <div className="overflow-auto border rounded">
      <table className="w-full text-sm table-fixed">
        <thead className="bg-muted/50">
          <tr>
            {header.map((h) => (
              <th key={h} className="px-2 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.join("|")} className="even:bg-muted/20">
              {r.map((c) => (
                <td key={c} className="px-2 py-1 align-top whitespace-pre-wrap">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function parseCsv(input: string): string[][] {
  // Strip BOM and comment-only lines beginning with '#'
  input = input.replace(/^\uFEFF/, "")
  input = input
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        row.push(field)
        field = ""
      } else if (ch === "\n") {
        row.push(field)
        rows.push(row)
        row = []
        field = ""
      } else if (ch === "\r") {
        // ignore
      } else {
        field += ch
      }
    }
  }
  // flush last
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
