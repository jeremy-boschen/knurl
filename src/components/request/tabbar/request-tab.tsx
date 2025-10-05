import type * as React from "react"

import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { HttpBadge } from "@/components/ui/knurl"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { cn } from "@/lib/utils"
import { useRequestsTabSummary } from "@/state"

type RequestTabProps = {
  tabId: string
  onSelectTab: (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => void
  onCloseTab: (event: React.MouseEvent<HTMLButtonElement>) => void
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void
}

export default function RequestTab({ tabId, onSelectTab, onCloseTab, onContextMenu }: RequestTabProps) {
  const { isActive, name, method, isDirty } = useRequestsTabSummary(tabId)

  return (
    <div
      role="treeitem"
      tabIndex={0}
      key={tabId}
      className={cn(
        "group relative w-full flex h-12 min-w-0 max-w-48 cursor-pointer items-center px-3 rounded-t-xl border-r border-t first-of-type:border-l",
        isActive ? "bg-accent text-foreground" : "bg-background text-muted-foreground",
      )}
      data-state={isActive ? "active" : "inactive"}
      data-tab-id={tabId}
      onClick={onSelectTab}
      onKeyDown={onSelectTab}
      onContextMenu={onContextMenu}
    >
      {/* Active tab indicator */}
      {isActive && <div className={cn("absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary")}></div>}

      <div className="flex min-w-0 flex-1 items-center space-x-2">
        <HttpBadge method={method} className="shrink-0" />
        <span className="flex-1 truncate text-sm">
          {name}
          {isDirty && <span className="ml-1 text-warning">•</span>}
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-6 w-6 shrink-0 p-0"
            data-tab-id={tabId}
            onClick={onCloseTab}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close Tab</TooltipContent>
      </Tooltip>
    </div>
  )
}
