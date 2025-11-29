import { useState } from "react"

import { ChevronDownIcon, ChevronRightIcon, FolderClosedIcon } from "lucide-react"

import type { CollectionCache, CollectionFolderNode } from "@/types"
import { FolderItemList } from "./folder-item-list"
import { RequestItemList } from "./request-item-list"

type FolderItemProps = {
  collection: CollectionCache
  folder: CollectionFolderNode
}

export function FolderItem({ collection, folder }: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSelected, setIsSelected] = useState(false)

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
    setIsSelected((prev) => !prev)
  }

  return (
    <div>
      <div data-folder-id={folder.id} role="treeitem" aria-expanded={isOpen} tabIndex={0}>
        <button
          type="button"
          onClick={handleToggle}
          className="flex w-full items-center space-x-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          aria-pressed={isSelected}
          aria-expanded={isOpen}
        >
          <span aria-hidden className="text-primary">
            {isOpen ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
          </span>
          <span aria-hidden className="text-primary">
            <FolderClosedIcon className="h-3.5 w-3.5" />
          </span>
          <span>{folder.name}</span>
        </button>
      </div>

      {isOpen ? (
        <div className="ml-4 space-y-1">
          <RequestItemList collection={collection} folder={folder} requestIds={folder.requestIds} />

          {folder.childFolderIds.map((childFolderId) => (
            <FolderItemList key={childFolderId} collection={collection} folderId={childFolderId} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
