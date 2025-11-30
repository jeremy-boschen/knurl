export type CollectionTreeState = {
  searchTerm: string
}

export interface CollectionTreeApi {
  setSearchTerm(term: string): void
  clearSearch(): void
}

export interface CollectionTreeSlice {
  collectionTreeState: CollectionTreeState
  collectionTreeApi: CollectionTreeApi
}
