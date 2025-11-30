/**
 * Collection tree UI state - manages search and filtering for the collection tree display.
 * This is a presentation layer state, not persisted to storage.
 *
 * searchTerm: The current search query entered by the user
 */
export type CollectionTreeState = {
  searchTerm: string
}

export interface CollectionTreeApi {
  /**
   * Update search term. showableIds computation happens per-collection in components
   * via useShowableIds hook, which defers computation via useDeferredValue.
   */
  setSearchTerm(term: string): void
  clearSearch(): void
}

export interface CollectionTreeSlice {
  collectionTreeState: CollectionTreeState
  collectionTreeApi: CollectionTreeApi
}
