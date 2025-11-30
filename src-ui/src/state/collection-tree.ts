import type { StateCreator } from "zustand"

import type { Application, CollectionTreeApi, CollectionTreeSlice } from "@/types"

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
