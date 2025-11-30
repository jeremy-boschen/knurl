/**
 * Collection tree UI state - manages search and filtering for the collection tree display.
 * This is a presentation layer state, not persisted to storage.
 *
 * searchTerm: The current search query entered by the user
 * expandedIds: Record of collection/folder IDs that are currently expanded (id -> true)
 */
export type CollectionTreeState = {
  searchTerm: string
  expandedIds: Record<string, boolean>
}

export interface CollectionTreeApi {
  /**
   * Update search term. showableIds computation happens per-collection in components
   * via useShowableIds hook, which defers computation via useDeferredValue.
   */
  setSearchTerm(term: string): void
  clearSearch(): void
  /**
   * Toggle expanded state for a collection or folder by ID
   */
  toggleExpanded(id: string): void
  /**
   * Set expanded state explicitly for an ID
   */
  setExpanded(id: string, expanded: boolean): void
}

export interface CollectionTreeSlice {
  collectionTreeState: CollectionTreeState
  collectionTreeApi: CollectionTreeApi
}
