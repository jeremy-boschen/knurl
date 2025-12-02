import { useMemo } from "react"

import { ChevronDownIcon, ChevronRightIcon, FolderClosedIcon, FolderOpenIcon } from "lucide-react"

import { useCollections, useCollectionTree, useSidebar } from "@/state"
import { Button } from "@/components/ui/button"

const MAX_VISIBLE_ITEMS = 10

export function CollectionTreeCollapsed() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  const {
    state: { expandedIds },
    actions: { toggleExpanded },
  } = useCollectionTree()

  const {
    actions: { expandSidebar },
  } = useSidebar()

  const visibleCollections = useMemo(() => collectionsIndex.slice(0, MAX_VISIBLE_ITEMS), [collectionsIndex])

  const hasMore = useMemo(() => collectionsIndex.length > MAX_VISIBLE_ITEMS, [collectionsIndex])

  const handleCollectionClick = (collectionId: string) => {
    expandSidebar()
    toggleExpanded(collectionId)
  }

  const handleMoreClick = () => {
    expandSidebar()
  }

  return (
    <div className="space-y-1" role="tree">
      {visibleCollections.map((entry) => {
        const isOpen = Boolean(expandedIds[entry.id])

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => handleCollectionClick(entry.id)}
            className="group flex w-full items-center justify-between rounded p-2 text-sm hover:bg-accent"
            aria-expanded={isOpen}
            data-collection-id={entry.id}
            data-kind="collection"
            data-name={entry.name}
            role="treeitem"
            tabIndex={0}
          >
            <span className="flex items-center space-x-2">
              <span aria-hidden className="text-primary">
                {isOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              </span>
              <span aria-hidden className="text-primary">
                {isOpen ? <FolderOpenIcon className="h-4 w-4" /> : <FolderClosedIcon className="h-4 w-4" />}
              </span>
              <span className="truncate">{entry.name}</span>
            </span>
          </button>
        )
      })}

      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleMoreClick}
          className="w-full justify-center text-xs"
        >
          ...
        </Button>
      )}
    </div>
  )
}
