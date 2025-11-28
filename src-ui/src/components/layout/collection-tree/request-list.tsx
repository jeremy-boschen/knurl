import React from "react"

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import type { FolderOption } from "@/lib/collections/folder-options"
import type { RequestState } from "@/types/request"

import { RequestRow } from "./request-row"

export type RequestListProps = {
  collectionId: string
  folderId: string
  requests: RequestState[]
  folderOptions: FolderOption[]
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  filterQuery?: string
}

export function RequestList({
  collectionId,
  folderId,
  requests: sourceRequests,
  folderOptions,
  onAction,
  filterQuery,
}: RequestListProps) {
  // Note: sourceRequests may already be filtered (from CollectionRowSearchable)
  // so we don't re-filter, just use them directly
  const requests = sourceRequests

  const moveTargets = React.useMemo(
    () => folderOptions.filter((option) => option.id !== folderId),
    [folderOptions, folderId],
  )

  const folderOptionMap = React.useMemo(() => {
    return new Map(folderOptions.map((option) => [option.id, option.path]))
  }, [folderOptions])

  const showFolderContext = Boolean(filterQuery)
  const q = (filterQuery ?? "").trim().toLowerCase()

  const requestOrder = React.useMemo(() => requests.map((item) => item.id), [requests])

  const folderPathFor = React.useCallback(
    (request: RequestState) => {
      if (!showFolderContext) {
        return undefined
      }
      const rawPath = folderOptionMap.get(request.folderId ?? "")
      if (!rawPath) {
        return undefined
      }
      const trimmed = rawPath.replace(/^Root\s*\/\s*/i, "")
      return trimmed.length > 0 ? trimmed : undefined
    },
    [folderOptionMap, showFolderContext],
  )

  // Disable DnD while filtering to avoid confusing reorder behavior on subsets
  if (q) {
    return (
      <div>
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            r={r}
            collectionId={collectionId}
            folderId={folderId}
            onAction={onAction}
            dndDisabled={true}
            moveTargets={moveTargets}
            siblings={requestOrder}
            folderPath={folderPathFor(r)}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <SortableContext items={requestOrder} strategy={verticalListSortingStrategy}>
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            r={r}
            collectionId={collectionId}
            folderId={folderId}
            onAction={onAction}
            moveTargets={moveTargets}
            siblings={requestOrder}
            folderPath={folderPathFor(r)}
          />
        ))}
      </SortableContext>
    </div>
  )
}
