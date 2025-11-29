import React from "react"

import { FolderClosedIcon } from "lucide-react"

import type { CollectionFolderNode } from "@/types"

type FolderItemProps = {
  folder: CollectionFolderNode
}

export function FolderItem({ folder }: FolderItemProps) {
  return (
    <div className="folder-item" data-folder-id={folder.id} role="treeitem" aria-expanded>
      <span aria-hidden className="folder-item__icon">
        <FolderClosedIcon size={14} />
      </span>
      <span className="folder-item__name">{folder.name}</span>
    </div>
  )
}
