/**
 * Collection index operations
 *
 * Handles collection-level index management:
 * - Getting collections index
 * - Reordering collections
 */

import type { StateCreator } from "zustand"

import type { Application, CollectionsIndexEntry } from "@/types"
import { CollectionIndexFileName, CollectionIndexStorage } from "./core"

/**
 * Creates collection index operation handlers
 */
export function createIndexOps(set: ReturnType<StateCreator<Application>>, get: () => Application) {
  return {
    getCollectionsIndex(): CollectionsIndexEntry[] {
      return get().collectionsState.index
    },

    reorderCollections(orderIds: string[]) {
      set((app) => {
        const current = app.collectionsState.index.slice()
        const reord = orderIds
          .map((id) => current.find((e) => e.id === id))
          .filter((e): e is CollectionsIndexEntry => !!e)
        // Append any not present in orderIds to the end to be safe
        for (const e of current) {
          if (!reord.some((x) => x.id === e.id)) {
            reord.push(e)
          }
        }

        // Assign sequential order starting at 0
        let seq = 0
        for (const e of reord) {
          e.order = seq
          seq += 1
        }
        app.collectionsState.index = reord
      })

      void CollectionIndexStorage.save(CollectionIndexFileName(), get().collectionsState.index).catch((error) => {
        console.error("Failed to persist collections index", error)
      })
    },
  }
}
