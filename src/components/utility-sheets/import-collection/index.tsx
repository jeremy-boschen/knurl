import { useEffect, useMemo, useState } from "react"
import { AlertTriangleIcon, GitMergeIcon, UploadIcon, RotateCcwIcon } from "lucide-react"

import { openFile } from "@/bindings/knurl"
import { CodeEditor } from "@/components/editor/code-editor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LabeledField } from "@/components/ui/knurl"
import { Input } from "@/components/ui/knurl/input"
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCollections } from "@/state"

import { useImportParser } from "./use-import-parser"
import { useSelectionManager } from "./use-selection-manager"
import { useImportActions } from "./use-import-actions"
import { ValidationErrorDisplay } from "./components/validation-error-display"
import { ImportSourceStep } from "./components/import-source-step"
import { ImportPreviewStep } from "./components/import-preview-step"
import type { ImportFormat } from "./types"

type TabValue = "preview" | "native-source" | "openapi-source" | "postman-source"

export default function ImportCollectionSheet() {
  // --- STATE MANAGEMENT ---
  // Raw input state
  const [importData, setImportData] = useState("")
  const [importFormat, setImportFormat] = useState<ImportFormat>("auto")
  const [groupByTags, setGroupByTags] = useState(true)

  const openApiOptions = useMemo(() => ({ groupByTags }), [groupByTags])

  // Hook 1: Parsing and Validation
  const {
    collection: parsedCollection,
    issues: validationIssues,
    detectedFormat,
    convertedData,
  } = useImportParser(importData, importFormat, openApiOptions)

  // Hook 2: Selection Management
  const {
    requests,
    environments,
    selectedRequests,
    selectedEnvironments,
    reqMasterState,
    envMasterState,
    toggleRequestSelection,
    toggleAllRequests,
    toggleEnvironmentSelection,
    toggleAllEnvironments,
  } = useSelectionManager(parsedCollection)

  // Hook 3: Import Actions and Status
  const { status, setStatus, handleImport, handleOverwrite, handleMerge } = useImportActions(
    parsedCollection,
    selectedRequests,
    selectedEnvironments,
  )

  // UI-specific state
  const [activeTab, setActiveTab] = useState<TabValue>("preview")
  const [filter, setFilter] = useState("")
  const [collectionName, setCollectionName] = useState("")
  const [isConflict, setIsConflict] = useState(false)
  const {
    state: { collectionsIndex },
  } = useCollections()

  const shouldShowOpenApiOptions = useMemo(() => {
    if (importFormat === "openapi") {
      return true
    }
    if (importFormat === "auto" && detectedFormat === "openapi") {
      return true
    }
    return false
  }, [importFormat, detectedFormat])

  // Update collection name when parsed data changes
  useEffect(() => {
    if (parsedCollection?.collection.name) {
      setCollectionName(parsedCollection.collection.name)
    }
  }, [parsedCollection])

  // Check for name conflict
  useEffect(() => {
    if (collectionName) {
      const existing = collectionsIndex.find((c) => c.name.toLowerCase() === collectionName.trim().toLowerCase())
      setIsConflict(Boolean(existing))
    } else {
      setIsConflict(false)
    }
  }, [collectionName, collectionsIndex])

  // --- MEMOS & DERIVED STATE ---
  const formattedImportData = useMemo(() => {
    if (importData.trim().startsWith("{")) {
      try {
        return JSON.stringify(JSON.parse(importData), null, 2)
      } catch (_e) {
        /* return as is */
      }
    }
    return importData
  }, [importData])

  const canProceed = useMemo(
    () => !!parsedCollection && !validationIssues && selectedRequests.size > 0 && !!collectionName.trim(),
    [parsedCollection, validationIssues, selectedRequests, collectionName],
  )

  // --- HANDLERS ---
  const handleChooseFile = async () => {
    try {
      setStatus(null)
      const file = await openFile({
        title: "Import Collection",
        filters: [{ name: "Collection Files", extensions: ["json", "yaml", "yml"] }],
      })
      if (file?.content) {
        setImportData(file.content)
      }
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error)?.message ?? "Could not read file." })
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      setStatus(null)
      const text = await navigator.clipboard.readText()
      setImportData(text)
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error)?.message ?? "Could not access clipboard." })
    }
  }

  const onFinalImport = () => {
    handleImport(collectionName.trim())
  }

  const onFinalOverwrite = () => {
    handleOverwrite(collectionName.trim())
  }

  const onFinalMerge = () => {
    handleMerge(collectionName.trim())
  }

  // --- RENDER ---
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SheetHeader className="border-b px-6 pt-6 pb-4">
        <SheetTitle className="flex items-center gap-2 text-xl">
          <UploadIcon className="h-5 w-5" />
          Import Collection
        </SheetTitle>
        <SheetDescription>Choose which requests and environments to import.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-hidden px-6 py-5">
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto] gap-4">
          <div className={`grid transition-all ${status ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              {status && (
                <Alert variant={status.kind === "error" ? "destructive" : "default"}>
                  <AlertTitle>{status.kind === "error" ? "Import Failed" : "Import Successful"}</AlertTitle>
                  <AlertDescription className="flex items-center gap-2">
                    <span>{status.message}</span>
                    <div className="ml-auto flex gap-2">
                      {status.kind === "error" ? (
                        <Button size="sm" onClick={onFinalImport}>
                          <RotateCcwIcon className="mr-1 h-4 w-4" /> Retry
                        </Button>
                      ) : null}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <ImportSourceStep
            importFormat={importFormat}
            detectedFormat={detectedFormat}
            onChooseFile={handleChooseFile}
            onPaste={handlePasteFromClipboard}
            onFormatChange={setImportFormat}
            showOpenApiOptions={shouldShowOpenApiOptions}
            groupByTags={groupByTags}
            onGroupByTagsChange={setGroupByTags}
          />

          <div className="row-start-3 flex min-h-0 flex-col gap-2">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as TabValue)}
              className="flex min-h-0 flex-1 flex-col gap-2"
            >
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="native-source" disabled={!importData}>
                  Native Source
                </TabsTrigger>
                {detectedFormat === "openapi" && <TabsTrigger value="openapi-source">OpenAPI Source</TabsTrigger>}
                {detectedFormat === "postman" && <TabsTrigger value="postman-source">Postman Source</TabsTrigger>}
              </TabsList>

              <TabsContent value="preview" className="flex-1 min-h-0">
                {parsedCollection ? (
                  <ImportPreviewStep
                    requests={requests}
                    environments={environments}
                    selectedRequests={selectedRequests}
                    selectedEnvironments={selectedEnvironments}
                    reqMasterState={reqMasterState}
                    envMasterState={envMasterState}
                    onToggleRequest={toggleRequestSelection}
                    onToggleAllRequests={toggleAllRequests}
                    onToggleEnvironment={toggleEnvironmentSelection}
                    onToggleAllEnvironments={toggleAllEnvironments}
                    filter={filter}
                    onFilterChange={setFilter}
                  />
                ) : (
                  <div className="pt-10 text-center text-sm text-muted-foreground">
                    Please select a file or paste content to preview.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="native-source" className="relative flex-1 min-h-0">
                <CodeEditor
                  value={
                    detectedFormat === "openapi" || detectedFormat === "postman" ? convertedData : formattedImportData
                  }
                  onChange={setImportData}
                  className="absolute inset-0 h-full w-full rounded-sm border"
                  language="json"
                />
              </TabsContent>
              {detectedFormat === "openapi" && (
                <TabsContent value="openapi-source" className="relative flex-1 min-h-0">
                  <CodeEditor
                    value={formattedImportData}
                    onChange={setImportData}
                    className="absolute h-full w-full rounded-sm border"
                    language={importData.trim().startsWith("{") ? "json" : "yaml"}
                    lineNumbers
                  />
                </TabsContent>
              )}
              {detectedFormat === "postman" && (
                <TabsContent value="postman-source" className="relative flex-1 min-h-0">
                  <CodeEditor
                    value={formattedImportData}
                    onChange={setImportData}
                    className="absolute h-full w-full rounded-sm border"
                    language="json"
                    lineNumbers
                  />
                </TabsContent>
              )}
            </Tabs>
            {validationIssues && <ValidationErrorDisplay issues={validationIssues} />}
          </div>

          <div className="row-start-4 flex items-center justify-end gap-3">
            <LabeledField label="Collection Name" className="flex-1">
              <Input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                endAddon={
                  <div
                    className={`flex items-center gap-1.5 border-l px-2 text-xs text-yellow-600 transition-opacity ${
                      isConflict ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <AlertTriangleIcon className="h-3.5 w-3.5" />
                    <span>Name exists</span>
                  </div>
                }
              />
            </LabeledField>
            {isConflict ? (
              <div className="flex items-center gap-2">
                <Button variant="default" onClick={onFinalMerge} disabled={!canProceed}>
                  <GitMergeIcon className="h-4 w-4" />
                  Merge
                </Button>
                <Button variant="destructive" onClick={onFinalOverwrite} disabled={!canProceed}>
                  <UploadIcon className="h-4 w-4" />
                  Replace
                </Button>
              </div>
            ) : (
              <Button variant="default" onClick={onFinalImport} disabled={!canProceed}>
                <UploadIcon className="h-4 w-4" />
                Import
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
