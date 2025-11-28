import React from "react"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { buildFolderOptions } from "@/lib/collections/folder-options"
import { cn } from "@/lib/utils"
import { useCollection } from "@/state/application"
import { RootCollectionFolderId } from "@/types"
import type { RequestState } from "@/types/request"

import { CollectionFolderBranch } from "./folder-branch"
import { RequestList } from "./request-list"

export type CollectionContentProps = {
  collectionId: string
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

export const CollectionContent = React.memo(function CollectionContent({ collectionId, onAction }: CollectionContentProps) {
  const {
    state: { collection },
  } = useCollection(collectionId)
  const rootFolder = collection.folders[RootCollectionFolderId]
  const rootRequests =
    rootFolder?.requestIds.map((id) => collection.requests[id]).filter((r): r is RequestState => !!r) ?? []
  const folderOptions = React.useMemo(() => buildFolderOptions(collection), [collection])

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-root-${collectionId}`,
    data: {
      type: "folder-drop",
      collectionId,
      folderId: RootCollectionFolderId,
      childIds: rootFolder?.childFolderIds ? [...rootFolder.childFolderIds] : [],
    },
  })

  return (
    <div
      ref={setDropRef}
      className={cn("space-y-1", isOver && "rounded-md border border-dashed border-primary/50 bg-primary/5")}
    >
      <RequestList
        collectionId={collectionId}
        folderId={RootCollectionFolderId}
        requests={rootRequests}
        folderOptions={folderOptions}
        onAction={onAction}
      />

      <SortableContext items={rootFolder?.childFolderIds ?? []} strategy={verticalListSortingStrategy}>
        {rootFolder?.childFolderIds.map((folderId) => (
          <CollectionFolderBranch
            key={folderId}
            collection={collection}
            collectionId={collectionId}
            folderId={folderId}
            depth={0}
            folderOptions={folderOptions}
            onAction={onAction}
          />
        ))}
      </SortableContext>
    </div>
  )
})
