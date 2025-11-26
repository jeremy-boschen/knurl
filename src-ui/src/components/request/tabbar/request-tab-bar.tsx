/**
 * @module RequestTabBar
 * @since 1.0.0
 * @description Manages the bar of active request tabs
 */

import React, { useTransition } from "react"

import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { collectionsApi, ScratchCollectionId, useOpenTabs } from "@/state"
import RequestTab from "./request-tab"

export default function RequestTabBar() {
  const [_isPending, startTransition] = useTransition()
  const {
    state: { openTabs },
    actions: { requestTabsApi },
  } = useOpenTabs()

  const handleNewRequestTab = async (_: React.MouseEvent<HTMLButtonElement>) => {
    await collectionsApi().loadCollection(ScratchCollectionId)

    requestTabsApi.createRequestTab()
  }

  const handleSelectTab = (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    if ("key" in event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      event.preventDefault()
    }
    const tabId = event.currentTarget.dataset.tabKey
    if (tabId) {
      startTransition(() => {
        requestTabsApi.setActiveTab(tabId)
      })
    }
  }

  const handleCloseTab = (event: React.MouseEvent<HTMLButtonElement>) => {
    const tabId = event.currentTarget.dataset.tabKey
    if (tabId) {
      void requestTabsApi.removeTab(tabId)
    }
  }

  const handleContextMenu = React.useCallback(
    (tabId: string) => {
      startTransition(() => {
        requestTabsApi.setActiveTab(tabId)
      })
    },
    [requestTabsApi],
  )

  const renderTabContextMenu = (tabId: string) => {
    const targetIndex = openTabs.findIndex((tab) => tab.tabId === tabId)
    const canCloseLeft = targetIndex > 0
    const canCloseRight = targetIndex !== -1 && targetIndex < openTabs.length - 1
    const canCloseOthers = openTabs.length > 1

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <RequestTab
            tabId={tabId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onContextMenu={() => handleContextMenu(tabId)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent data-test-id="request-tab-bar:context-menu">
          <ContextMenuItem
            onClick={() => void requestTabsApi.removeTab(tabId)}
            data-test-id="request-tab-bar:context-menu:close"
          >
            <XIcon className="mr-2 h-4 w-4" />
            Close tab
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => void requestTabsApi.closeOthers(tabId)}
            disabled={!canCloseOthers}
            data-test-id="request-tab-bar:context-menu:close-others"
          >
            <span className="mr-2 h-4 w-4" />
            Close other tabs
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => void requestTabsApi.closeTabsToLeft(tabId)}
            disabled={!canCloseLeft}
            data-test-id="request-tab-bar:context-menu:close-left"
          >
            <span className="mr-2 h-4 w-4" />
            Close tabs to the left
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => void requestTabsApi.closeTabsToRight(tabId)}
            disabled={!canCloseRight}
            data-test-id="request-tab-bar:context-menu:close-right"
          >
            <span className="mr-2 h-4 w-4" />
            Close tabs to the right
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => void requestTabsApi.closeAllTabs()}
            data-test-id="request-tab-bar:context-menu:close-all"
          >
            <XIcon className="mr-2 h-4 w-4" />
            Close all tabs
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  if (openTabs.length === 0) {
    return null
  }

  return (
    <div className="flex h-12 items-center overflow-hidden overflow-x-auto" data-test-id="request-tab-bar">
      <div className="flex flex-1 items-center min-w-0 gap-0">
        {openTabs.map((tab) => (
          <React.Fragment key={tab.tabId}>{renderTabContextMenu(tab.tabId)}</React.Fragment>
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 m-4"
          onClick={handleNewRequestTab}
          aria-label="New Request"
          data-test-id="request-tab-bar:new-request-button"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
