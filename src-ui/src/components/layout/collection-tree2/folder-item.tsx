import { useState } from "react"

import { ChevronDownIcon, ChevronRightIcon, FolderClosedIcon } from "lucide-react"

import type { CollectionFolderNode } from "@/types"

type FolderItemProps = {
  folder: CollectionFolderNode
}

export function FolderItem({ folder }: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSelected, setIsSelected] = useState(false)

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
    setIsSelected((prev) => !prev)
  }

  return (
    <div
      data-folder-id={folder.id}
      role="treeitem"
      aria-expanded={isOpen}
      tabIndex={0}
    >
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
  )
}
