import type { StateCreator } from "zustand"

import { computeShowableIds } from "@/lib/collection-tree-filter"
import type { Application, Collection, CollectionTreeApi, CollectionTreeSlice } from "@/types"

/**
 * Collection tree state slice - manages UI-specific state for the collection tree.
 *
 * State:
 * - searchTerm: current search query
 * - showableIds: computed Set of IDs that match the search (includes ancestors)
 *
 * API:
 * - setSearchTerm: update search and compute showable IDs
 * - clearSearch: clear search and show all items
 *
 * Note: Computation of showableIds is deferred in components via useDeferredValue
 * to keep the search input responsive while filtering happens at lower priority.
 */
export const collectionTreeSliceCreator: StateCreator<
  Application,
  [["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  CollectionTreeSlice
> = (set) => {
  const collectionTreeApi: CollectionTreeApi = {
    setSearchTerm(term: string, collection?: Collection) {
      set((app) => {
        app.collectionTreeState.searchTerm = term
        // Compute showable IDs if collection provided, otherwise clear them
        if (collection) {
          app.collectionTreeState.showableIds = computeShowableIds(collection, term)
        } else {
          app.collectionTreeState.showableIds = new Set()
        }
      })
    },

    clearSearch() {
      set((app) => {
        app.collectionTreeState.searchTerm = ""
        app.collectionTreeState.showableIds = new Set()
      })
    },
  }

  return {
    collectionTreeState: {
      searchTerm: "",
      showableIds: new Set(),
    },
    collectionTreeApi,
  }
}
