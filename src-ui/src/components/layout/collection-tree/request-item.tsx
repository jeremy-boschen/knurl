import type React from "react"

import { Clickable, HttpBadge } from "@/components/ui/knurl"
import { cn, isNotEmpty } from "@/lib"
import { getRequestTabsApi, useCollectionFromCache, useCollectionTree } from "@/state"
import { useShowableIds } from "@/hooks/use-showable-ids"

type RequestItemProps = {
  collectionId: string
  requestId: string
}

const handleRequestClick = async (event: React.MouseEvent | React.KeyboardEvent) => {
  if ("key" in event && event.key !== "Enter" && event.key !== " ") {
    return
  }

  const target = event.currentTarget as HTMLElement | null
  if (!target) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const collectionId = target.dataset.collectionId
  const requestId = target.dataset.requestId

  if (collectionId && requestId) {
    getRequestTabsApi().openRequestTab(collectionId, requestId)
  }
}

export function RequestItem({ collectionId, requestId }: RequestItemProps) {
  const {
    state: { collection },
  } = useCollectionFromCache(collectionId)
  const {
    state: { searchTerm },
  } = useCollectionTree()
  const showableIds = useShowableIds(collection, searchTerm)

  const request = collection.requests[requestId]
  if (!request) {
    return null
  }

  // If filtering and request not in showable set, don't render
  if (showableIds && !showableIds.has(requestId)) {
    return null
  }

  return (
    <Clickable
      className={cn(
        "flex items-center justify-start space-x-2 rounded px-2 py-2 cursor-pointer text-sm hover:bg-muted min-w-0",
      )}
      data-test-id={`collection-tree:request-row:${requestId}`}
      data-collection-id={collectionId}
      data-request-id={requestId}
      data-kind="request"
      data-name={request.name}
      role="treeitem"
      tabIndex={0}
      onClick={handleRequestClick}
    >
      <span aria-hidden className="text-primary shrink-0">
        <HttpBadge method={request.method} className={cn(isNotEmpty(request.patch) && "unsaved-changes")} />
      </span>
      <span className="pt-1 text-sm leading-none truncate">{request.name}</span>
    </Clickable>
  )
}
