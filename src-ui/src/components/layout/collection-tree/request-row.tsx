import React from "react"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { MoreHorizontalIcon } from "lucide-react"

import { useOptionalDndTreeContext } from "@/components/layout/dnd-tree-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { HttpBadge } from "@/components/ui/knurl"
import { RequestMenuContent } from "@/components/ui/knurl/request-menu"
import type { FolderOption } from "@/lib/collections/folder-options"
import { cn, isNotEmpty } from "@/lib/utils"
import { isScratchCollection } from "@/state/application"
import type { RequestState } from "@/types/request"

import type { RequestDragData } from "./actions/action-types"

export type RequestRowProps = {
  r: RequestState
  collectionId: string
  folderId: string
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  dndDisabled?: boolean
  moveTargets: FolderOption[]
  siblings: string[]
  folderPath?: string
}

export const RequestRow = React.memo(
  function RequestRow({
    r,
    collectionId,
    folderId,
    onAction,
    dndDisabled = false,
    moveTargets = [],
    siblings,
    folderPath,
  }: RequestRowProps) {
    const dndContext = useOptionalDndTreeContext()
    const dropIndicator = dndContext?.dropIndicator ?? null
    const isOver = dropIndicator?.id === r.id
    const dropPosition = isOver ? (dropIndicator?.position ?? null) : null
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: r.id,
      data: {
        type: "request-item",
        collectionId,
        requestId: r.id,
        folderId,
        siblings,
      } satisfies RequestDragData,
      disabled: isScratchCollection(collectionId) || dndDisabled,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const isScratch = isScratchCollection(collectionId)
    return (
      <div
        ref={setNodeRef}
        style={style}
        role="treeitem"
        tabIndex={0}
        className={cn(
          "group/col relative flex w-full cursor-pointer items-center justify-between rounded p-2 hover:bg-accent has-[button[data-state=open]]:bg-accent",
          isDragging && "opacity-50",
          isOver && dropPosition === "middle" && "bg-primary/10",
        )}
        data-testid="collection-request-row"
        data-action-id="select"
        data-kind="request"
        data-collection-id={collectionId}
        data-request-id={r.id}
        data-folder-id={folderId}
        onClick={onAction}
        onKeyDown={onAction}
        data-test-id={`collection-tree:request-row:${r.id}`}
      >
        {isOver && dropPosition === "top" && <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-10" />}
        {isOver && dropPosition === "bottom" && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10" />
        )}
        <div className="flex flex-1 items-start space-x-2">
          <div
            className={cn(
              "tree-offset-stack",
              !isScratch && !dndDisabled && "hover:cursor-grab active:cursor-grabbing",
            )}
            title={
              isScratchCollection(collectionId)
                ? "Scratch requests cannot be reordered"
                : dndDisabled
                  ? "Reordering disabled while filtering"
                  : "Drag to reorder"
            }
            {...(!isScratch && !dndDisabled ? { ...attributes, ...listeners } : {})}
          >
            <div className="flex items-center space-x-2">
              <div className="relative">
                <HttpBadge method={r.method} className={cn(isNotEmpty(r.patch) && "unsaved-changes")} />
              </div>
              <span className="pt-1 text-sm leading-none">{r.name}</span>
            </div>
            {folderPath && <span className="pl-6 text-xs text-muted-foreground max-w-64 truncate">{folderPath}</span>}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 dropdown-trigger group-hover/col:opacity-100 transition-none"
                data-test-id={`collection-tree:request-row:menu-button:${r.id}`}
              >
                <MoreHorizontalIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <RequestMenuContent
              collectionId={collectionId}
              requestId={r.id}
              requestName={r.name}
              isScratch={isScratch}
              moveTargets={moveTargets.map((target) => ({ id: target.id, path: target.path }))}
              onAction={(payload) => onAction(payload)}
            />
          </DropdownMenu>
        </div>
      </div>
    )
  },
  (prev, next) => {
    // Custom comparator: only re-render if these specific props changed
    return (
      prev.r.id === next.r.id &&
      prev.r.name === next.r.name &&
      prev.r.method === next.r.method &&
      prev.r.patch === next.r.patch && // Unsaved changes indicator
      prev.collectionId === next.collectionId &&
      prev.folderId === next.folderId &&
      prev.dndDisabled === next.dndDisabled &&
      prev.folderPath === next.folderPath &&
      prev.moveTargets.length === next.moveTargets.length &&
      prev.siblings.length === next.siblings.length
    )
  },
)
