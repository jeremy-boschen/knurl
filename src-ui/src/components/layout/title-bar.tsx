import { useLayoutEffect, useRef, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RestoreIcon } from "@/components/icons"
import { ScratchCollectionId, useCollectionsApi, useOpenTabs, useRequestTab } from "@/state"
import { Breadcrumbs } from "./breadcrumbs"
import { EnvironmentSelector } from "./environment-selector"

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const isLoadedRef = useRef(false)

  useLayoutEffect(() => {
    const updateWindowState = async () => {
      const window = await getCurrentWindow()
      setIsMaximized(await window.isMaximized())
      isLoadedRef.current = true
    }

    updateWindowState()
  }, [])

  const activeTabData = useRequestTab()
  const {
    actions: { requestTabsApi },
  } = useOpenTabs()

  const collectionsApi = useCollectionsApi()

  const handleNewRequest = async () => {
    await collectionsApi().loadCollection(ScratchCollectionId)

    requestTabsApi.createRequestTab()
  }

  const handleMaximizeRestore = async () => {
    const window = await getCurrentWindow()
    if (isMaximized) {
      await window.unmaximize()
      setIsMaximized(false)
    } else {
      await window.maximize()
      setIsMaximized(true)
    }
  }

  return (
    <div className="flex flex-grow items-center justify-end mr-1" data-test-id="title-bar" data-tauri-drag-region>
      {activeTabData ? (
        <>
          <div className="flex-shrink-0" data-tauri-drag-region="false">
            <Breadcrumbs />
          </div>
          <div className="flex-shrink-0 ml-2" data-tauri-drag-region="false">
            <EnvironmentSelector />
          </div>
        </>
      ) : (
        <div className="flex-shrink-0 pl-4" data-tauri-drag-region="false">
          <Button
            variant="ghost"
            size="default"
            className="h-8"
            onClick={handleNewRequest}
            aria-label="New Request"
            data-test-id="titlebar:new-request-button"
            data-tauri-drag-region="false"
          >
            <PlusIcon className="mr-1 h-4 w-4" />
            New Request
          </Button>
        </div>
      )}

      <div className="flex-grow" />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => getCurrentWindow().minimize()}
        data-test-id="title-bar:minimize-button"
        data-tauri-drag-region="false"
      >
        <MinusIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleMaximizeRestore}
        data-test-id="title-bar:maximize-button"
        data-tauri-drag-region="false"
      >
        {isMaximized ? (
          <RestoreIcon className="h-4 w-4" />
        ) : (
          <MaximizeIcon className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-destructive"
        onClick={() => getCurrentWindow().close()}
        data-test-id="title-bar:close-button"
        data-tauri-drag-region="false"
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}
