import type { Collection, CollectionCache, CollectionsIndex } from "./collection"
import type { CollectionsApi } from "./api"

export type CollectionsState = {
  index: CollectionsIndex["index"]
  cache: Record<Collection["id"], CollectionCache>
}

export interface CollectionsSlice {
  collectionsState: CollectionsState
  collectionsApi: CollectionsApi
}
