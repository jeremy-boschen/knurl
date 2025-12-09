import { Suspense } from "react"

import { ChevronDownIcon, ChevronRightIcon, FolderClosedIcon, FolderOpenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCollection, useCollectionTree } from "@/state"
import { RootCollectionFolderId } from "@/types"
import { FolderItemList } from "./folder-item-list"

type CollectionItemProps = {
  collectionId: string
  collectionName: string
}

export function CollectionItem({ collectionId, collectionName }: CollectionItemProps) {
  const {
    state: { expandedIds },
    actions: { toggleExpanded },
  } = useCollectionTree()
  const isOpen = Boolean(expandedIds[collectionId])

  // NOTE: We intentionally do NOT call useCollection() here to avoid loading all
  // collections upfront. Collections should only be loaded when the user actually
  // expands them in the tree. This is deferred to CollectionItemBody which is only
  // rendered when isOpen is true.

  const handleToggle = () => {
    toggleExpanded(collectionId)
  }

  return (
    <div
      data-test-id={`collection-tree:collection-row:${collectionId}`}
      data-collection-id={collectionId}
      data-kind="collection"
      data-name={collectionName}
      role="treeitem"
      aria-expanded={isOpen}
      tabIndex={0}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        data-test-id={`collection-tree:expand-toggle:${collectionId}`}
        className="group w-full justify-between"
        aria-expanded={isOpen}
      >
        <span className="flex items-center space-x-2">
          <span aria-hidden className="text-primary">
            {isOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
          </span>
          <span aria-hidden className="text-primary">
            {isOpen ? <FolderOpenIcon className="h-4 w-4" /> : <FolderClosedIcon className="h-4 w-4" />}
          </span>
          <span>{collectionName}</span>
        </span>
      </Button>

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
