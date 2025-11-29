import React, { Suspense } from "react"

import { ChevronDownIcon, ChevronRightIcon, FolderClosedIcon } from "lucide-react"

import { useCollection, useCollections } from "@/state"
import { RootCollectionFolderId } from "@/types"

import { FolderItemList } from "./folder-item-list"

type CollectionItemProps = {
  collectionId: string
}

export function CollectionItem({ collectionId }: CollectionItemProps) {
  const {
    state: { collectionsIndex },
  } = useCollections()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isSelected, setIsSelected] = React.useState(false)

  const entry = React.useMemo(
    () => collectionsIndex.index.find((item) => item.id === collectionId),
    [collectionId, collectionsIndex],
  )

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
    setIsSelected((prev) => !prev)
  }

  const label = entry?.name ?? "Collection"

  return (
    <div className="collection-item" data-collection-id={collectionId} role="treeitem" aria-expanded={isOpen}>
      <button
        type="button"
        onClick={handleToggle}
        className="collection-item__header"
        aria-pressed={isSelected}
        aria-expanded={isOpen}
      >
        <span aria-hidden className="collection-item__chevron">
          {isOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        </span>
        <span aria-hidden className="collection-item__icon">
          <FolderClosedIcon size={14} />
        </span>
        <span className="collection-item__name">{label}</span>
      </button>

      {isOpen ? (
        <Suspense fallback={<div className="collection-item__loading">Loading collection...</div>}>
          <CollectionItemBody collectionId={collectionId} />
        </Suspense>
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
