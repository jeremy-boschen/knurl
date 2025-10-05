/**
 * @module RequestTabBar
 * @since 1.0.0
 * @description Manages the bar of active request tabs
 */

import React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { useOpenTabs } from "@/state"
import NewRequestButton from "./new-request-button"
import RequestTab from "./request-tab"

type ContextMenuButtonProps = {
  label: string
  onClick: () => void
  disabled?: boolean
}

function RequestTabContextMenuButton({ label, onClick, disabled }: ContextMenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "w-full rounded px-3 py-2 text-left text-sm",
        disabled ? "text-muted-foreground/60" : "hover:bg-accent",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export default function RequestTabBar() {
  const {
    state: { openTabs },
    actions: { requestTabsApi },
  } = useOpenTabs()
  const [contextMenu, setContextMenu] = React.useState<{
    tabId: string
    clientX: number
    clientY: number
  } | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  const handleContextMenu = React.useCallback(
    (tabId: string) => (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      requestTabsApi.setActiveTab(tabId)
      setContextMenu({ tabId, clientX: event.clientX, clientY: event.clientY })
    },
    [requestTabsApi],
  )

  const dismissContextMenu = React.useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleNewRequestTab = (_: React.MouseEvent<HTMLButtonElement>) => {
    void requestTabsApi.createRequestTab()
  }

  const handleSelectTab = (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    if ("key" in event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      event.preventDefault()
    }
    const tabId = event.currentTarget.dataset.tabId
    if (tabId) {
      requestTabsApi.setActiveTab(tabId)
    }
  }

  const handleCloseTab = (event: React.MouseEvent<HTMLButtonElement>) => {
    const tabId = event.currentTarget.dataset.tabId
    if (tabId) {
      void requestTabsApi.removeTab(tabId)
    }
  }

  const handleMenuAction = React.useCallback(
    (action: "close" | "close-all" | "close-left" | "close-right") => {
      if (!contextMenu) {
        return
      }

      switch (action) {
        case "close": {
          void requestTabsApi.removeTab(contextMenu.tabId)
          break
        }
        case "close-all": {
          void requestTabsApi.closeAllTabs()
          break
        }
        case "close-left": {
          void requestTabsApi.closeTabsToLeft(contextMenu.tabId)
          break
        }
        case "close-right": {
          void requestTabsApi.closeTabsToRight(contextMenu.tabId)
          break
        }
      }

      dismissContextMenu()
    },
    [contextMenu, dismissContextMenu, requestTabsApi],
  )

  React.useEffect(() => {
    if (!contextMenu) {
      return
    }

    const frame = requestAnimationFrame(() => {
      const firstButton = menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")
      firstButton?.focus()
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [contextMenu])

  if (openTabs.length === 0) {
    return null
  }

  const contextMenuContent = contextMenu
    ? (() => {
        const menuWidth = 192
        const menuHeight = 160
        const { innerWidth, innerHeight } = window
        const left = Math.min(contextMenu.clientX, innerWidth - menuWidth)
        const top = Math.min(contextMenu.clientY, innerHeight - menuHeight)
        const targetIndex = openTabs.findIndex((tab) => tab.tabId === contextMenu.tabId)
        const canCloseLeft = targetIndex > 0
        const canCloseRight = targetIndex !== -1 && targetIndex < openTabs.length - 1

        return createPortal(
          <button
            type="button"
            className="fixed inset-0 z-50"
            onMouseDown={dismissContextMenu}
            onContextMenu={(event) => {
              event.preventDefault()
              dismissContextMenu()
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                dismissContextMenu()
              }
            }}
          >
            <div
              ref={menuRef}
              className="absolute z-50 min-w-[12rem] rounded-md border border-border bg-popover p-1 shadow-lg"
              role="menu"
              style={{ top, left }}
              tabIndex={-1}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault()
                  dismissContextMenu()
                }
              }}
            >
              <RequestTabContextMenuButton label="Close" onClick={() => handleMenuAction("close")} />
              <RequestTabContextMenuButton label="Close All" onClick={() => handleMenuAction("close-all")} />
              <RequestTabContextMenuButton
                label="Close Left"
                onClick={() => handleMenuAction("close-left")}
                disabled={!canCloseLeft}
              />
              <RequestTabContextMenuButton
                label="Close Right"
                onClick={() => handleMenuAction("close-right")}
                disabled={!canCloseRight}
              />
            </div>
          </button>,
          document.body,
        )
      })()
    : null

  return (
    <div className="flex h-12 items-center overflow-hidden overflow-x-auto">
      <div className="flex flex-1 items-center min-w-0 gap-0">
        {openTabs.map((tab) => (
          <RequestTab
            key={tab.tabId}
            tabId={tab.tabId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onContextMenu={handleContextMenu(tab.tabId)}
          />
        ))}

        <NewRequestButton onClick={handleNewRequestTab} />
      </div>
      {contextMenuContent}
    </div>
  )
}
