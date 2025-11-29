import { FolderClosedIcon } from "lucide-react"

import type { CollectionFolderNode } from "@/types"

type FolderItemProps = {
  folder: CollectionFolderNode
}

export function FolderItem({ folder }: FolderItemProps) {
  return (
    <div
      className="flex items-center space-x-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
      data-folder-id={folder.id}
      role="treeitem"
      aria-expanded
      tabIndex={0}
    >
      <span aria-hidden className="text-primary">
        <FolderClosedIcon className="h-3.5 w-3.5" />
      </span>
      <span>{folder.name}</span>
    </div>
  )
}
