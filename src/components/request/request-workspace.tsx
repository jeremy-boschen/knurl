import type * as React from "react"
import { useRef, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

import { LayoutPanelLeftIcon, LayoutPanelTopIcon, SaveIcon, SendIcon, SquareIcon } from "lucide-react"

import ErrorBoundary from "@/components/error/error-boundary"
import SaveRequestDialog from "@/components/request/save-request-dialog"
import ResponseViewer from "@/components/response/response-viewer"
import { Button } from "@/components/ui/button"
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
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib"
import { ScratchCollectionId, useRequestTab } from "@/state"
import type { HttpMethod } from "@/types"
import { RequestEditor } from "./editor"

const httpMethods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

type RequestWorkspaceProps = {
  tabId: string
}

export default function RequestWorkspace({ tabId }: RequestWorkspaceProps) {
  const requestTab = useRequestTab(tabId)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [_userResizedTabs, setUserResizedTabs] = useState<Record<string, boolean>>({})
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical")

  // Save Request Dialog
  const [showSaveRequestDialog, setShowSaveRequestDialog] = useState(false)

  const activeTab = requestTab?.state.activeTab
  const request = requestTab?.state.request
  const original = requestTab?.state.original
  const requestTabsApi = requestTab?.actions.requestTabsApi

  if (!requestTab || !activeTab || !request || !original || !requestTabsApi) {
    return null
  }

  const isDirty = requestTab.state.isDirty

  const handleMethodChange = (method: HttpMethod) => {
    requestTabsApi.updateTabRequest(activeTab.tabId, { method })
    requestAnimationFrame(() => urlInputRef.current?.focus())
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    requestTabsApi.updateTabRequest(activeTab.tabId, { url: e.target.value })
  }

  const handleSendRequest = async () => {
    if (!activeTab) {
      return
    }
    requestTabsApi.clearResponse(activeTab.tabId)
    await requestTabsApi.sendRequest(activeTab.tabId, request)
  }

  const handleSaveRequest = async () => {
    if (!activeTab) {
      return
    }

    if (request?.collectionId !== ScratchCollectionId) {
      await requestTabsApi.saveTab(activeTab.tabId)
    } else {
      setShowSaveRequestDialog(true)
    }
  }

  const handleSaveNewRequest = async (collectionId: string, name: string) => {
    if (!activeTab) {
      return
    }

    if (request.collectionId !== collectionId) {
      await requestTabsApi.saveNewTab(activeTab.tabId, collectionId, name)
    }
  }

  const handleResize = () => {
    if (activeTab) {
      setUserResizedTabs((prev) => ({
        ...prev,
        [activeTab.tabId]: true,
      }))
    }
  }

  const isVerticalLayout = layout === "vertical"
  const panelResizeCursor = isVerticalLayout ? "cursor-row-resize" : "cursor-col-resize"
  const panelGroupDirection = isVerticalLayout ? "vertical" : "horizontal"
  const panelGroupFlexDirection = isVerticalLayout ? "flex-col" : "flex-row"
  const resizeHandleLineClass = isVerticalLayout ? "h-[1px] w-full" : "w-[1px] h-full"
  const hasResponse = Boolean(activeTab?.response)

  return (
    <>
      {showSaveRequestDialog && (
        <SaveRequestDialog
          open={true}
          onSave={handleSaveNewRequest}
          onClose={() => setShowSaveRequestDialog(false)}
          request={request}
        />
      )}

      <div className="flex h-full flex-1 flex-col overflow-auto">
        <PanelGroup
          key={layout}
          direction={panelGroupDirection}
          className={cn("flex h-full w-full", panelGroupFlexDirection)}
          onLayout={handleResize}
        >
          <Panel minSize={hasResponse ? (isVerticalLayout ? 5 : 20) : undefined} className="overflow-hidden">
            <div className="flex h-full w-full flex-col">
              <div className="w-full shrink-0 py-3 px-2 bg-muted">
                <div className="flex w-full items-center gap-2">
                  <Select name="method" key={activeTab.tabId} value={request.method} onValueChange={handleMethodChange}>
                    <SelectTrigger
                      className={cn("w-[120px] font-mono", original.method !== request.method && "unsaved-changes")}
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
                    value={request?.url}
                    onChange={handleUrlChange}
                    className={cn("flex-1 font-mono", original.url !== request.url && "unsaved-changes")}
                  />

                  {activeTab.sending ? (
                    <Button onClick={() => requestTabsApi.cancelRequest(activeTab.tabId)} variant="destructive">
                      <SquareIcon className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  ) : (
                    <Button onClick={handleSendRequest}>
                      <SendIcon className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                  )}

                  <Button onClick={handleSaveRequest} variant="outline" disabled={!isDirty}>
                    <SaveIcon className="mr-2 h-4 w-4" />
                    Save
                  </Button>

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
                <RequestEditor tabId={activeTab.tabId} />
              </ErrorBoundary>
            </div>
          </Panel>

          {hasResponse && (
            <>
              <PanelResizeHandle className={cn("z-10 flex items-center justify-center", panelResizeCursor)}>
                <div className={cn("bg-muted", resizeHandleLineClass)} />
              </PanelResizeHandle>

              <Panel className="overflow-auto" minSize={isVerticalLayout ? undefined : 20}>
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
}
