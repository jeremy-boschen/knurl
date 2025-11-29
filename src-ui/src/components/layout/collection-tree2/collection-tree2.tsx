import React from "react"

import { useCollections } from "@/state"
import { CollectionItem } from "./collection-item"

export function CollectionTree2() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  const handleContextMenu = React.useCallback(async (event: React.MouseEvent | React.KeyboardEvent) => {
    const target = event.currentTarget as HTMLElement | null
    if (!target) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const collectionId = target.dataset.collectionId
    const requestId = target.dataset.requestId
    const kind = target.dataset.kind

    switch (kind) {
      case "collection":
        break
      case "folder":
        break
      case "request":
        break
    }
  }, [])

  return (
    <div className="space-y-2" role="tree">
      {collectionsIndex.map((entry) => (
        <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
      ))}
    </div>
  )
}
