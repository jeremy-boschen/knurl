import { useCallback, useEffect, useMemo, useState } from "react"

import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { revealItemInDir } from "@tauri-apps/plugin-opener"
import { ChevronDownIcon, ClipboardCopyIcon, FolderOpenIcon, RotateCcwIcon, UploadIcon, XIcon } from "lucide-react"

import { saveFile } from "@/bindings/knurl"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LabeledField } from "@/components/ui/knurl"
import { Input } from "@/components/ui/knurl/input"
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCollection, useCollections } from "@/state"

type ExportFormat = "native-json" | "openapi-json" | "openapi-yaml"

const ExportFileFilters = {
  json: [
    {
      name: "YAML",
      extensions: ["yml", "yaml"],
    },
  ],
  yaml: [
    {
      name: "JSON",
      extensions: ["json"],
    },
  ],
}

interface Props {
  collectionId: string
}

export default function ExportCollectionSheet({ collectionId }: Props) {
  const {
    state: { collection },
  } = useCollection(collectionId)
  const {
    actions: { collectionsApi },
  } = useCollections()

  const [status, setStatus] = useState<{ kind: "success" | "error"; path?: string; message?: string } | null>(null)
  const [filter, setFilter] = useState("")
  const [format, setFormat] = useState<ExportFormat>("native-json")

  const requests = useMemo(() => Object.values(collection.requests ?? {}), [collection])
  const environments = useMemo(() => Object.values(collection?.environments ?? {}), [collection])

  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [selectedEnvironments, setSelectedEnvironments] = useState<Set<string>>(new Set())

  // init selection on open
  useEffect(() => {
    setSelectedRequests(new Set(requests.map((r) => r.id)))
    setSelectedEnvironments(new Set(environments.map((e) => e.id)))
    setStatus(null)
    setFilter("")
  }, [requests, environments])

  const filteredReqs = useMemo(() => {
    const qq = filter.trim().toLowerCase()
    if (!qq) {
      return requests
    }
    return requests.filter((r) => [r.name, r.method, r.url ?? ""].some((v) => v.toLowerCase().includes(qq)))
  }, [filter, requests])

  // tri-state helpers
  const reqMasterState: boolean | "indeterminate" =
    selectedRequests.size === 0 ? false : selectedRequests.size === requests.length ? true : "indeterminate"
  const envMasterState: boolean | "indeterminate" =
    selectedEnvironments.size === 0 ? false : selectedEnvironments.size === environments.length ? true : "indeterminate"

  const toggle = (set: Set<string>, id: string, checked: boolean) => {
    const next = new Set(set)
    checked ? next.add(id) : next.delete(id)
    return next
  }

  const canExport = selectedRequests.size > 0

  const handleExport = useCallback(async () => {
    try {
      setStatus(null)
      const exported = await collectionsApi().exportCollection(collectionId)

      // Filter requests and environments based on selection
      const selectedRequestIds = new Set(selectedRequests)
      const selectedEnvironmentIds = new Set(selectedEnvironments)

      exported.collection.requests = Object.values(exported.collection.requests ?? {}).filter((r) =>
        r.id ? selectedRequestIds.has(r.id) : false,
      )
      exported.collection.environments = Object.values(exported.collection.environments ?? {}).filter((e) =>
        e.id ? selectedEnvironmentIds.has(e.id) : false,
      )

      const payload = JSON.stringify(exported, null, 2)

      const path = await saveFile(payload, {
        title: "Save exported collection",
        defaultPath: `${collection.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.json`,
        filters: ExportFileFilters.json,
      })
      setStatus({ kind: "success", path })
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error)?.message ?? String(err) })
    }
  }, [collectionId, selectedRequests, selectedEnvironments, collection.name, collectionsApi])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SheetHeader className="border-b px-6 pt-6 pb-4">
        <SheetTitle className="flex items-center gap-2 text-xl">
          <UploadIcon className="h-5 w-5" />
          Export {collection.name}
        </SheetTitle>
        <SheetDescription>Choose which requests and environments to export from this collection.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-hidden px-6 py-5">
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-4">
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${status ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            aria-live="polite"
          >
            <div className="overflow-hidden">
              {status && (
                <Alert variant={status?.kind === "error" ? "destructive" : "default"} className="mb-2">
                  <AlertTitle className="flex items-center">
                    {status?.kind === "error" ? "Export failed" : "Export successful"}
                  </AlertTitle>
                  <AlertDescription className="flex items-center gap-2">
                    {status?.kind === "success" && status.path && (
                      <span className="truncate text-xs text-muted-foreground">{status.path}</span>
                    )}
                    {status?.kind === "error" && (
                      <span className="text-sm">{status.message ?? "Something went wrong."}</span>
                    )}
                    <div className="ml-auto flex gap-2">
                      {status?.kind === "success" && status.path && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => revealItemInDir(status.path as string)}>
                            <FolderOpenIcon className="mr-1 h-4 w-4" /> Reveal
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => writeText(status.path as string)}>
                            <ClipboardCopyIcon className="mr-1 h-4 w-4" /> Copy path
                          </Button>
                        </>
                      )}
                      {status?.kind === "error" && (
                        <>
                          <Button size="sm" onClick={handleExport}>
                            <RotateCcwIcon className="mr-1 h-4 w-4" /> Retry
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setStatus(null)}>
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="row-start-2 grid min-h-0 grid-cols-[1.3fr_0.8fr] gap-4 overflow-hidden">
            {/* Requests */}
            <section className="flex min-h-0 flex-col rounded-md border">
              <header className="flex items-center justify-between px-3 py-2 border-b gap-2">
                <div className="flex items-center gap-2">
                  <LabeledField label="Requests" placement="right">
                    <Checkbox
                      checked={reqMasterState}
                      onCheckedChange={(c) => {
                        if (c === true) {
                          setSelectedRequests(new Set(requests.map((r) => r.id)))
                        } else {
                          setSelectedRequests(new Set())
                        }
                      }}
                    />
                  </LabeledField>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    name="export-filter"
                    value={filter}
                    onChange={(e) => setFilter(e.currentTarget.value)}
                    placeholder="Filter (name/method/url)"
                    className="w-[240px]"
                    endAddon={
                      <Button variant="ghost" size="sm" onClick={() => setFilter("")} className="rounded-l-none">
                        <XIcon className="w-4 h-4" />
                      </Button>
                    }
                  />
                </div>
              </header>

              <div className="flex-1 min-h-0 overflow-auto p-1">
                {requests.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No requests in this collection.</p>
                ) : filteredReqs.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No matches for “{filter}”.</p>
                ) : (
                  <ul className="space-y-1">
                    {filteredReqs.map((r) => {
                      const checked = selectedRequests.has(r.id)
                      return (
                        <li key={r.id}>
                          <label
                            htmlFor={`req-${r.id}`}
                            className="grid grid-cols-[auto_0.4fr_1fr_minmax(0,1fr)] items-center gap-2 p-2 rounded hover:bg-muted/50 focus-within:bg-muted/60 cursor-pointer min-w-0"
                          >
                            <Checkbox
                              id={`req-${r.id}`}
                              checked={checked}
                              onCheckedChange={(c) => setSelectedRequests((s) => toggle(s, r.id, c === true))}
                            />
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded shrink-0 basis-8">
                              {r.method}
                            </span>
                            <span className="text-sm font-medium">{r.name}</span>
                            <span className="text-xs text-muted-foreground truncate">{r.url || " "}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* Environments */}
            <section className="flex min-h-0 flex-col rounded-md border">
              <header className="flex items-center justify-between px-3 py-2 border-b gap-2">
                <div className="flex items-center gap-2">
                  <LabeledField label="Environments">
                    <Checkbox
                      checked={envMasterState}
                      onCheckedChange={(c) => {
                        if (c === true) {
                          setSelectedEnvironments(new Set(environments.map((e) => e.id)))
                        } else {
                          setSelectedEnvironments(new Set())
                        }
                      }}
                      disabled={environments.length === 0}
                    />
                  </LabeledField>
                </div>
                {/* no extra controls here */}
              </header>

              <div className="flex-1 min-h-0 overflow-auto p-1">
                {environments.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No environments available.</p>
                ) : (
                  <ul className="space-y-1">
                    {environments.map((e) => {
                      const varCount = Object.keys(e.variables ?? {}).length
                      const checked = selectedEnvironments.has(e.id)
                      return (
                        <li key={e.id}>
                          <label
                            htmlFor={`env-${e.id}`}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 focus-within:bg-muted/60 cursor-pointer min-w-0"
                          >
                            <Checkbox
                              id={`env-${e.id}`}
                              checked={checked}
                              onCheckedChange={(c) => setSelectedEnvironments((s) => toggle(s, e.id, c === true))}
                            />
                            <span className="text-sm truncate">{e.name}</span>
                            <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-muted-foreground/10 shrink-0">
                              {varCount} vars
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <div className="row-start-3 flex items-center justify-between gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="default" variant="ghost">
                  <span className="sr-only">Choose export format</span>
                  <ChevronDownIcon className="h-4 w-4" /> Format
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-[200px]">
                <DropdownMenuItem onClick={() => setFormat("native-json")} inset>
                  {format === "native-json" ? "✓ " : ""}Native JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFormat("openapi-json")} inset>
                  {format === "openapi-json" ? "✓ " : ""}OpenAPI (JSON)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFormat("openapi-yaml")} inset>
                  {format === "openapi-yaml" ? "✓ " : ""}OpenAPI (YAML)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleExport} disabled={!canExport}>
              <UploadIcon className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
