import { useMemo } from "react"

import type { Collection } from "@/types"

/**
 * Hook to compute showable IDs for collection tree filtering.
 *
 * Usage in components:
 * ```tsx
 * const showableIds = useShowableIds(collection, searchTerm)
 * if (showableIds && !showableIds.has(itemId)) return null
 * ```
 *
 * How it works:
 * 1. Computes once when collection or searchTerm changes
 * 2. Returns a Set of IDs that should be visible
 * 3. Includes both matches AND their ancestors (so context is visible)
 *
 * Performance:
 * - Single pass through collection structure O(n)
 * - Set lookups are O(1)
 * - Only recomputes when collection or searchTerm actually change
 *
 * Returns:
 * - null if no search term (everything is shown)
 * - Set<string> of showable IDs if search term is active
 */
export function useShowableIds(collection: Collection, searchTerm: string): Set<string> | null {
  return useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) {
      return null
    }

    const showable = new Set<string>()
    const ancestors = new Set<string>()

    // Helper to add ancestors of a folder
    const addFolderAncestors = (folderId: string) => {
      let currentId: string | null = folderId
      while (currentId !== null) {
        ancestors.add(currentId)
        const folder = collection.folders[currentId]
        currentId = folder?.parentId ?? null
      }
    }

    // Check if string matches query
    const matches = (value: string): boolean => value.toLowerCase().includes(query)

    // Find matching requests
    for (const [requestId, request] of Object.entries(collection.requests)) {
      if (matches(request.name) || matches(request.method) || matches(request.url ?? "")) {
        showable.add(requestId)
        // Mark request's folder and all ancestors
        const folderId = request.folderId ?? ""
        if (folderId) {
          addFolderAncestors(folderId)
        }
      }
    }

    // Find matching folders
    for (const [folderId, folder] of Object.entries(collection.folders)) {
      if (matches(folder.name)) {
        showable.add(folderId)
        // Mark folder's ancestors
        addFolderAncestors(folderId)
      }
    }

    // Combine both sets
    return new Set([...showable, ...ancestors])
  }, [collection, searchTerm])
}
