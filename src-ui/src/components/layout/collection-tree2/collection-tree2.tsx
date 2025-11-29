import { useCollections } from "@/state"
import { CollectionItem } from "./collection-item"

export function CollectionTree2() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  return (
    <div className="collection-tree2 space-y-2" role="tree">
      {collectionsIndex.index.map((entry) => (
        <CollectionItem key={entry.id} collectionId={entry.id} />
      ))}
    </div>
  )
}
