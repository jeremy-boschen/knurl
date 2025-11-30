import { useDeferredValue, useState } from "react"

import { FolderClosedIcon } from "lucide-react"

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

  const [isOpen, setIsOpen] = useState(false)
  const {
    state: { searchTerm },
  } = useCollectionTree()
  const showableIds = useShowableIds(collection, searchTerm)
  const deferredShowableIds = useDeferredValue(showableIds)

  // If searching and folder ID not in showable, don't render
  if (deferredShowableIds && !deferredShowableIds.has(folderId)) {
    return null
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
  }

  return (
    <div>
      <div
        data-collection-id={collectionId}
        data-folder-id={folderId}
        data-kind="folder"
        data-name={folder.name}
        role="treeitem"
        aria-expanded={isOpen}
        tabIndex={0}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex w-full items-center space-x-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          aria-expanded={isOpen}
        >
          <span aria-hidden className="text-primary">
            <FolderClosedIcon className="h-3.5 w-3.5" />
          </span>
          <span>{folder.name}</span>
        </button>
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
