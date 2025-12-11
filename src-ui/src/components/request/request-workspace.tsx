import React, { useRef, useState, useEffect, useTransition } from "react"

import { Panel, PanelGroup, ResizeHandle } from "@jeremy-boschen/react-adjustable-panels"
import "@jeremy-boschen/react-adjustable-panels/style.css"

import { ChevronDownIcon, LayoutPanelLeftIcon, LayoutPanelTopIcon, SaveIcon, SendIcon } from "lucide-react"

import ErrorBoundary from "@/components/error/error-boundary"
import SaveRequestDialog from "@/components/request/save-request-dialog"
import ResponseViewer from "@/components/response/response-viewer"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupButton } from "@/components/ui/input-group"
import { Input } from "@/components/ui/knurl/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/sonner"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib"
import { buildExportCommand } from "@/lib/request/exporters"
import { ScratchCollectionId, useRequestTab } from "@/state"
import { credentialsCacheApi, useCollection } from "@/state/application"
import type { HttpMethod, RequestState } from "@/types"
import { RequestEditor } from "./editor"

const httpMethods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

type RequestWorkspaceProps = {
  tabId: string
}

type LoadedRequestTab = NonNullable<ReturnType<typeof useRequestTab>>

type RequestWorkspaceContentProps = {
  requestTab: LoadedRequestTab
}

const RequestWorkspaceContent = React.memo(function RequestWorkspaceContent({
  requestTab,
}: RequestWorkspaceContentProps) {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [_userResizedTabs, setUserResizedTabs] = useState<Record<string, boolean>>({})
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical")
  const [exporting, setExporting] = useState<"curl" | "wget" | "fetch" | null>(null)
  const [showSaveRequestDialog, setShowSaveRequestDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [displayedTabId, setDisplayedTabId] = useState(requestTab.state.activeTab.tabId)

  // Sync displayedTabId immediately with the passed requestTab to prevent using deleted tabs
  if (displayedTabId !== requestTab.state.activeTab.tabId) {
    setDisplayedTabId(requestTab.state.activeTab.tabId)
  }

  // Optionally defer displaying changes for smoother transitions in normal cases
  // But this is bypassed when the component receives a different prop (which already causes a sync above)
  useEffect(() => {
    const newTabId = requestTab.state.activeTab.tabId
    if (newTabId !== displayedTabId) {
      startTransition(() => {
        setDisplayedTabId(newTabId)
      })
    }
  }, [requestTab.state.activeTab.tabId, displayedTabId])

  const { state, actions } = requestTab
  const activeTab = state.activeTab as NonNullable<typeof state.activeTab>
  const request = state.request as NonNullable<typeof state.request>
  const original = state.original as NonNullable<typeof state.original>
  const requestTabsApi = actions.requestTabsApi as NonNullable<typeof actions.requestTabsApi>

  const {
    state: { collection },
  } = useCollection(request.collectionId)

  const isDirty = state.isDirty

  // Show response panel if we have HTTP response data OR error logs
  const hasResponse = Boolean(activeTab.response?.data || activeTab.response?.logs?.length)

  const handleMethodChange = (method: HttpMethod) => {
    requestTabsApi.updateTabRequest(activeTab.tabId, { method })
    requestAnimationFrame(() => urlInputRef.current?.focus())
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    requestTabsApi.updateTabRequest(activeTab.tabId, { url: e.target.value })
  }

  const handleSendRequest = async () => {
    requestTabsApi.clearResponse(activeTab.tabId)
    await requestTabsApi.sendRequest(activeTab.tabId, request)
  }

  const handleSaveRequest = () => {
    if (request.collectionId !== ScratchCollectionId) {
      requestTabsApi.saveTab(activeTab.tabId)
      return
    }
    setShowSaveRequestDialog(true)
  }

  const handleSaveNewRequest = async (collectionId: string, name: string) => {
    if (request.collectionId !== collectionId) {
      requestTabsApi.saveNewTab(activeTab.tabId, collectionId, name)
    }
  }

  const handleResize = () => {
    setUserResizedTabs((prev) => ({
      ...prev,
      [activeTab.tabId]: true,
    }))
    return undefined
  }

  const isVerticalLayout = layout === "vertical"
  const panelResizeCursor = isVerticalLayout ? "cursor-row-resize" : "cursor-col-resize"
  const panelGroupDirection = isVerticalLayout ? "vertical" : "horizontal"
  const panelGroupFlexDirection = isVerticalLayout ? "flex-col" : "flex-row"
  const resizeHandleLineClass = isVerticalLayout ? "h-[1px] w-full" : "w-[1px] h-full"

  const handleExport = async (format: "curl" | "wget" | "fetch") => {
    try {
      setExporting(format)
      const envId = activeTab.selectedEnvironmentId ?? collection.activeEnvironmentId
      const environment = envId ? collection.environments?.[envId] : undefined
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API is unavailable in this environment.")
      }
      const command = await buildExportCommand(format, {
        request,
        collection,
        environment,
        credentialsCacheApi: credentialsCacheApi(),
      })
      await navigator.clipboard.writeText(command)
      toast.success(`Copied ${format === "fetch" ? "fetch()" : format.toUpperCase()} command to clipboard`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare export command."
      toast.error(message)
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      {showSaveRequestDialog && (
        <SaveRequestDialog
          open={true}
          onSave={handleSaveNewRequest}
          onClose={() => setShowSaveRequestDialog(false)}
          request={request as RequestState}
        />
      )}

      <div className="flex h-full flex-1 flex-col overflow-hidden min-h-0" data-test-id="request-workspace">
        <PanelGroup
          key={layout}
          direction={panelGroupDirection}
          className={cn("flex h-full w-full", panelGroupFlexDirection)}
          onResize={handleResize}
        >
          <Panel
            key="request-editor"
            minSize={hasResponse ? (isVerticalLayout ? "5%" : "200px") : undefined}
            className="overflow-hidden"
          >
            <div className="relative flex h-full w-full flex-col">
              <div className="w-full shrink-0 bg-muted py-3 px-2">
                <div className="flex w-full items-center gap-2">
                  <Select name="method" key={activeTab.tabId} value={request.method} onValueChange={handleMethodChange}>
                    <SelectTrigger
                      className={cn("w-[120px] font-mono", original.method !== request.method && "unsaved-changes")}
                      data-test-id="request-workspace:method-select"
                    >
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent
                      onCloseAutoFocus={(e) => {
                        e.preventDefault()
                      }}
                    >
                      <SelectGroup>
                        <SelectLabel>Method</SelectLabel>
                        {httpMethods.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Input
                    ref={urlInputRef}
                    name="url"
                    type="text"
                    placeholder="Enter request URL..."
                    value={request.url}
                    onChange={handleUrlChange}
                    className={cn("flex-1 font-mono", original.url !== request.url && "unsaved-changes")}
                    data-test-id="request-workspace:url-input"
                  />

                  {activeTab.sending ? (
                    <Button
                      onClick={() => requestTabsApi.cancelRequest(activeTab.tabId)}
                      variant="destructive"
                      className="transition-none"
                      data-test-id="request-workspace:cancel-button"
                    >
                      <Spinner className="mr-1 h-4 w-4" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendRequest}
                      className="transition-none"
                      data-test-id="request-workspace:send-button"
                    >
                      <SendIcon className="mr-1 h-4 w-4" />
                      Send
                    </Button>
                  )}

                  <InputGroup className="w-fit">
                    <InputGroupButton
                      onClick={handleSaveRequest}
                      variant="ghost"
                      className="h-full"
                      size="sm"
                      disabled={!isDirty}
                      data-testid="save-request-button"
                      data-test-id="request-workspace:save-button"
                    >
                      <SaveIcon className="mr-1 h-4 w-4" />
                      Save
                    </InputGroupButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <InputGroupButton
                          aria-label="Export request"
                          variant="ghost"
                          size="icon-sm"
                          className="h-full"
                          disabled={exporting !== null}
                          data-test-id="request-workspace:export-menu-button"
                        >
                          <ChevronDownIcon className="h-4 w-4" />
                        </InputGroupButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4}>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Copy As</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => void handleExport("curl")}
                            disabled={exporting !== null}
                            data-test-id="request-workspace:export-option-curl"
                          >
                            cURL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void handleExport("wget")}
                            disabled={exporting !== null}
                            data-test-id="request-workspace:export-option-wget"
                          >
                            Wget
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void handleExport("fetch")}
                            disabled={exporting !== null}
                            data-test-id="request-workspace:export-option-fetch"
                          >
                            fetch()
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </InputGroup>

                  <Toggle
                    className="ml-1"
                    aria-label="Toggle response layout"
                    title={isVerticalLayout ? "Show response beside request" : "Show response below request"}
                    pressed={!isVerticalLayout}
                    onPressedChange={(pressed) => {
                      setLayout(pressed ? "horizontal" : "vertical")
                    }}
                    size="sm"
                    variant="outline"
                    data-test-id="request-workspace:layout-toggle-button"
                  >
                    {isVerticalLayout ? (
                      <LayoutPanelTopIcon className="h-4 w-4" />
                    ) : (
                      <LayoutPanelLeftIcon className="h-4 w-4" />
                    )}
                  </Toggle>
                </div>
              </div>

              <ErrorBoundary>
                {isPending && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/50">
                    <Spinner className="h-6 w-6" />
                  </div>
                )}
                <RequestEditor tabId={displayedTabId} />
              </ErrorBoundary>
            </div>
          </Panel>

          {hasResponse && (
            <>
              <ResizeHandle
                size={8}
                className={cn("z-50 flex items-center justify-center", panelResizeCursor)}
                key="resize"
              >
                <div className={cn("bg-transparent", resizeHandleLineClass)} />
              </ResizeHandle>

              <Panel className="overflow-auto" defaultSize="50%" minSize="110px" key="response-viewer">
                <ResponseViewer
                  tabId={activeTab.tabId}
                  className={cn(!isVerticalLayout && "border-l border-l-background")}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </>
  )
})

export default function RequestWorkspace({ tabId }: RequestWorkspaceProps) {
  const requestTab = useRequestTab(tabId)

  const activeTab = requestTab?.state.activeTab
  const request = requestTab?.state.request
  const original = requestTab?.state.original
  const requestTabsApi = requestTab?.actions.requestTabsApi

  if (!requestTab || !activeTab || !request || !original || !requestTabsApi) {
    return null
  }

  return <RequestWorkspaceContent requestTab={requestTab} />
}
