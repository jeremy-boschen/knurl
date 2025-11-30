import { Suspense, useState, useMemo } from "react"

import { ChevronDownIcon, ChevronRightIcon, FolderClosedIcon } from "lucide-react"

import { useCollection, useCollectionTree } from "@/state"
import { RootCollectionFolderId } from "@/types"
import type { Collection } from "@/types"
import { FolderItemList } from "./folder-item-list"

type CollectionItemProps = {
  collectionId: string
  collectionName: string
}

// Helper to check if a collection or any of its contents match the search
function collectionHasMatches(collection: Collection, query: string): boolean {
  // Check if collection name matches
  if (collection.name.toLowerCase().includes(query)) {
    return true
  }

  // Check if any request matches
  for (const request of Object.values(collection.requests)) {
    if (!request) {
      continue
    }
    if ([request.name, request.method, request.url ?? ""].some((v) => v.toLowerCase().includes(query))) {
      return true
    }
  }

  // Check if any folder matches
  for (const folder of Object.values(collection.folders)) {
    if (!folder) {
      continue
    }
    if (folder.name.toLowerCase().includes(query)) {
      return true
    }
  }

  return false
}

export function CollectionItem({ collectionId, collectionName }: CollectionItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const {
    state: { collection },
  } = useCollection(collectionId)
  const {
    state: { searchTerm },
  } = useCollectionTree()

  // Check if this collection should be shown based on search
  const shouldShow = useMemo(() => {
    if (!searchTerm.trim()) {
      return true
    }
    const query = searchTerm.trim().toLowerCase()
    return collectionHasMatches(collection, query)
  }, [collection, searchTerm])

  if (!shouldShow) {
    return null
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
  }

  return (
    <div
      data-collection-id={collectionId}
      data-kind="collection"
      data-name={collectionName}
      role="treeitem"
      aria-expanded={isOpen}
      tabIndex={0}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="group flex w-full items-center justify-between rounded p-2 text-sm hover:bg-accent"
        aria-expanded={isOpen}
      >
        <span className="flex items-center space-x-2">
          <span aria-hidden className="text-primary">
            {isOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
          </span>
          <span aria-hidden className="text-primary">
            <FolderClosedIcon className="h-4 w-4" />
          </span>
          <span>{collectionName}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="ml-3 space-y-1">
          <Suspense fallback={<div className="px-2 py-1 text-sm text-muted-foreground">Loading collection...</div>}>
            <CollectionItemBody collectionId={collectionId} />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}

function CollectionItemBody({ collectionId }: { collectionId: string }) {
  useCollection(collectionId)

  return <FolderItemList collectionId={collectionId} folderId={RootCollectionFolderId} />
}
