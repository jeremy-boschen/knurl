import { Suspense, useState } from "react"

import { ChevronDownIcon, ChevronRightIcon, FolderClosedIcon } from "lucide-react"

import { useCollection } from "@/state"
import { RootCollectionFolderId } from "@/types"
import { FolderItemList } from "./folder-item-list"

type CollectionItemProps = {
  collectionId: string
  collectionName: string
}

export function CollectionItem({ collectionId, collectionName }: CollectionItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSelected, setIsSelected] = useState(false)

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
    setIsSelected((prev) => !prev)
  }

  return (
    <div
      className="collection-item relative"
      data-collection-id={collectionId}
      role="treeitem"
      aria-expanded={isOpen}
      tabIndex={0}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="collection-item__header group flex w-full items-center justify-between rounded p-2 text-sm hover:bg-accent"
        aria-pressed={isSelected}
        aria-expanded={isOpen}
      >
        <span className="flex items-center space-x-2">
          <span aria-hidden className="collection-item__chevron text-primary">
            {isOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
          </span>
          <span aria-hidden className="collection-item__icon text-primary">
            <FolderClosedIcon className="h-4 w-4" />
          </span>
          <span className="collection-item__name">{collectionName}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="ml-6 space-y-1">
          <Suspense
            fallback={
              <div className="collection-item__loading px-2 py-1 text-sm text-muted-foreground">
                Loading collection...
              </div>
            }
          >
            <CollectionItemBody collectionId={collectionId} />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}

function CollectionItemBody({ collectionId }: { collectionId: string }) {
  const {
    state: { collection },
  } = useCollection(collectionId)

  return <FolderItemList collection={collection} folderId={RootCollectionFolderId} />
}
