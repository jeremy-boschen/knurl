import { FolderClosedIcon, FolderOpenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCollectionFromCache, useCollectionTree } from "@/state"
import { useShowableIds } from "@/hooks/use-showable-ids"
import { FolderItemList } from "./folder-item-list"
import { RequestItemList } from "./request-item-list"

type FolderItemProps = {
  collectionId: string
  folderId: string
}

export function FolderItem({ collectionId, folderId }: FolderItemProps) {
  const {
    state: { collection },
  } = useCollectionFromCache(collectionId)
  // biome-ignore lint/style/noNonNullAssertion: Safe
  const folder = collection.folders[folderId]!

  const {
    state: { searchTerm, expandedIds },
    actions: { toggleExpanded },
  } = useCollectionTree()
  const showableIds = useShowableIds(collection, searchTerm)
  const isOpen = Boolean(expandedIds[folderId])

  // If filtering and folder not in showable set, don't render
  if (showableIds && !showableIds.has(folderId)) {
    return null
  }

  const handleToggle = () => {
    toggleExpanded(folderId)
  }

  return (
    <div>
      <div
        data-test-id={`collection-tree:folder-row:${folderId}`}
        data-collection-id={collectionId}
        data-folder-id={folderId}
        data-kind="folder"
        data-name={folder.name}
        role="treeitem"
        aria-expanded={isOpen}
        tabIndex={0}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="flex w-full items-center space-x-2 text-muted-foreground"
          aria-expanded={isOpen}
        >
          <span aria-hidden className="text-primary">
            {isOpen ? <FolderOpenIcon className="h-3.5 w-3.5" /> : <FolderClosedIcon className="h-3.5 w-3.5" />}
          </span>
          <span>{folder.name}</span>
        </Button>
      </div>

      {isOpen ? (
        <div className="ml-3 space-y-1">
          <RequestItemList collectionId={collectionId} folder={folder} />

          {folder.childFolderIds.map((childFolderId) => (
            <FolderItemList key={childFolderId} collectionId={collectionId} folderId={childFolderId} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
