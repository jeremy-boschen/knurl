import { useCollections } from "@/state"
import { CollectionTreeContextMenu } from "./context-menu"
import { CollectionItem } from "./collection-item"

export function CollectionTree2() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  return (
    <CollectionTreeContextMenu>
      <div className="space-y-2" role="tree">
        {collectionsIndex.map((entry) => (
          <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
        ))}
      </div>
    </CollectionTreeContextMenu>
  )
}
