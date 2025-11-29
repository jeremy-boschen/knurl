import { useCollections } from "@/state"
import { CollectionItem } from "./collection-item"
import { CollectionContextMenu } from "./context-menu"

export function CollectionTree2() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  return (
    <CollectionContextMenu>
      <div className="space-y-2" role="tree">
        {collectionsIndex.map((entry) => (
          <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
        ))}
      </div>
    </CollectionContextMenu>
  )
}
