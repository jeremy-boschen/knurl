import React from "react"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FolderClosedIcon, FolderOpenIcon, MoreHorizontalIcon } from "lucide-react"

import { useDndTreeContext } from "@/components/layout/dnd-tree-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FolderMenuContent } from "@/components/ui/knurl/folder-menu"
import type { FolderOption } from "@/lib/collections/folder-options"
import { cn } from "@/lib/utils"
import { isScratchCollection } from "@/state/collections"
import type { CollectionCache, RequestState } from "@/types/collections"
import { RootCollectionFolderId } from "@/types"

import type { FolderDragData } from "./actions/action-types"
import { RequestList } from "./request-list"

export type CollectionFolderBranchProps = {
  collection: CollectionCache
  collectionId: string
  folderId: string
  depth: number
  folderOptions: FolderOption[]
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

export function CollectionFolderBranch({
  collection,
  collectionId,
  folderId,
  depth,
  folderOptions,
  onAction,
}: CollectionFolderBranchProps) {
  const { dropIndicator } = useDndTreeContext()
  const isOver = dropIndicator?.id === folderId
  const dropPosition = isOver ? dropIndicator.position : null
  const folder = collection.folders[folderId]
  const parentId = folder?.parentId ?? RootCollectionFolderId
  const parentNode = collection.folders[parentId]
  const siblingOrder = parentNode?.childFolderIds ? [...parentNode.childFolderIds] : []
  const childFolderIds = folder?.childFolderIds ? [...folder.childFolderIds] : []
  const [open, setOpen] = React.useState(true)
  const isScratch = isScratchCollection(collectionId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
    data: {
      type: "folder-item",
      collectionId,
      folderId,
      parentId,
      siblings: siblingOrder,
      childIds: childFolderIds,
    } satisfies FolderDragData,
    disabled: isScratch,
  })
  const { setNodeRef: setFolderDropRef } = useDroppable({
    id: folderId,
    data: {
      type: "folder-item",
      collectionId,
      folderId,
      parentId,
      childIds: childFolderIds,
    },
  })

  const style = React.useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging],
  )

  if (!folder) {
    return null
  }

  const requests = folder.requestIds.map((id) => collection.requests[id]).filter((r): r is RequestState => !!r)

  const toggle = () => setOpen((prev) => !prev)

  return (
    <div role="tree" className="space-y-1" ref={setNodeRef} style={style}>
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={open}
        ref={setFolderDropRef}
        className={cn(
          "group/col relative flex w-full cursor-pointer items-center justify-between rounded p-2 hover:bg-accent",
          isDragging && "opacity-50",
          isOver && dropPosition === "middle" && "bg-primary/10",
        )}
        data-action-id="select:expand"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folderId}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            toggle()
          }
        }}
        style={{ marginLeft: depth * 12 }}
      >
        {isOver && dropPosition === "top" && <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-10" />}
        {isOver && dropPosition === "bottom" && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10" />
        )}
        <div className="flex flex-1 items-center space-x-2">
          <div
            className={cn("tree-offset-flex", !isScratch && "hover:cursor-grab active:cursor-grabbing")}
            title={isScratch ? undefined : "Drag to move folder"}
            {...(!isScratch ? { ...attributes, ...listeners } : {})}
          >
            {open ? (
              <FolderOpenIcon className="h-3 w-3 text-primary" />
            ) : (
              <FolderClosedIcon className="h-3 w-3 text-primary" />
            )}
            <span className="text-sm font-medium">{folder.name}</span>
          </div>
        </div>

        {!isScratchCollection(collectionId) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover/col:opacity-100"
                data-test-id={`collection-tree:folder-row:menu-button:${folderId}`}
              >
                <MoreHorizontalIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <FolderMenuContent collectionId={collectionId} folder={folder} onAction={(payload) => onAction(payload)} />
          </DropdownMenu>
        )}
      </div>

      {open && (
        <div className="ml-5 space-y-1">
          <RequestList
            collectionId={collectionId}
            folderId={folderId}
            requests={requests}
            folderOptions={folderOptions}
            onAction={onAction}
          />
          <SortableContext items={folder.childFolderIds} strategy={verticalListSortingStrategy}>
            {folder.childFolderIds.map((childId) => (
              <CollectionFolderBranch
                key={childId}
                collection={collection}
                collectionId={collectionId}
                folderId={childId}
                depth={depth + 1}
                folderOptions={folderOptions}
                onAction={onAction}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  )
}
