import type { StateCreator } from "zustand"

import type { Application, CollectionTreeApi, CollectionTreeSlice } from "@/types"

/**
 * Collection tree state slice - manages UI-specific state for the collection tree.
 *
 * State:
 * - searchTerm: current search query
 * - expandedIds: Set of collection/folder IDs that are currently expanded
 *
 * API:
 * - setSearchTerm: update search term
 * - clearSearch: clear search term
 * - toggleExpanded: toggle expanded state for an ID
 * - setExpanded: set expanded state explicitly
 *
 * Note: showableIds are computed per-collection in components via useShowableIds hook.
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

    toggleExpanded(id: string) {
      set((app) => {
        if (app.collectionTreeState.expandedIds.has(id)) {
          app.collectionTreeState.expandedIds.delete(id)
        } else {
          app.collectionTreeState.expandedIds.add(id)
        }
      })
    },

    setExpanded(id: string, expanded: boolean) {
      set((app) => {
        if (expanded) {
          app.collectionTreeState.expandedIds.add(id)
        } else {
          app.collectionTreeState.expandedIds.delete(id)
        }
      })
    },
  }

  return {
    collectionTreeState: {
      searchTerm: "",
      expandedIds: new Set(),
    },
    collectionTreeApi,
  }
}
