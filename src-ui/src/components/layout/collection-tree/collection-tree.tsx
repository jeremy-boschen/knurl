import { Profiler } from "react"

import { useCollections } from "@/state"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { CollectionItem } from "./collection-item"
import { CollectionContextMenu } from "./context-menu"

export function CollectionTree() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  return (
    <CollectionContextMenu>
      <Profiler id="CollectionTree" onRender={onProfilerRender}>
        <div className="space-y-2" role="tree" data-test-id="collection-tree">
          {collectionsIndex.map((entry) => (
            <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
          ))}
        </div>
      </Profiler>
    </CollectionContextMenu>
  )
}
