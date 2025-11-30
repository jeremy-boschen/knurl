import type { StateCreator } from "zustand"

import type { Application, CollectionTreeApi, CollectionTreeSlice } from "@/types"

/**
 * Collection tree state slice - manages UI-specific state for the collection tree.
 *
 * State:
 * - searchTerm: current search query
 *
 * API:
 * - setSearchTerm: update search term
 * - clearSearch: clear search term
 *
 * Note: showableIds are computed per-collection in components via useShowableIds hook,
 * which uses useDeferredValue to keep the search input responsive while filtering
 * happens at lower priority.
 */
export const collectionTreeSliceCreator: StateCreator<
  Application,
  [["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  CollectionTreeSlice
> = (set) => {
  const collectionTreeApi: CollectionTreeApi = {
    setSearchTerm(term: string) {
      set((app) => {
        app.collectionTreeState.searchTerm = term
      })
    },

    clearSearch() {
      set((app) => {
        app.collectionTreeState.searchTerm = ""
      })
    },
  }

  return {
    collectionTreeState: {
      searchTerm: "",
    },
    collectionTreeApi,
  }
}
