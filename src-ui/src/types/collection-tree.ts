import type { Collection } from "./collections"

/**
 * Collection tree UI state - manages search and filtering for the collection tree display.
 * This is a presentation layer state, not persisted to storage.
 *
 * searchTerm: The current search query entered by the user
 * showableIds: Set of collection/folder/request IDs that match the search (includes ancestors of matches)
 */
export type CollectionTreeState = {
  searchTerm: string
  showableIds: Set<string>
}

export interface CollectionTreeApi {
  /**
   * Update search term and compute showable IDs based on a collection.
   * Use this when the search term changes. The computation happens separately
   * and can be deferred via useDeferredValue in components.
   */
  setSearchTerm(term: string, collection?: Collection): void
  clearSearch(): void
}

export interface CollectionTreeSlice {
  collectionTreeState: CollectionTreeState
  collectionTreeApi: CollectionTreeApi
}
