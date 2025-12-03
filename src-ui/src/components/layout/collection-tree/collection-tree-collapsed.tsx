import { useMemo } from "react"

import { FolderClosedIcon, FolderOpenIcon } from "lucide-react"

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
    <div className="flex flex-col items-center gap-3 p-2" role="tree">
      {visibleCollections.map((entry) => {
        const isOpen = Boolean(expandedIds[entry.id])

        return (
          <Button
            key={entry.id}
            type="button"
            onClick={() => handleCollectionClick(entry.id)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-primary hover:text-primary"
            aria-expanded={isOpen}
            data-collection-id={entry.id}
            data-kind="collection"
            data-name={entry.name}
            role="treeitem"
            tabIndex={0}
            title={entry.name}
          >
            <span aria-hidden className="text-primary">
              {isOpen ? <FolderOpenIcon className="h-4 w-4" /> : <FolderClosedIcon className="h-4 w-4" />}
            </span>
          </Button>
        )
      })}

      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleMoreClick}
          className="h-6 w-6 p-0 text-primary hover:text-primary text-xs"
          title="Show all collections"
        >
          ...
        </Button>
      )}
    </div>
  )
}
