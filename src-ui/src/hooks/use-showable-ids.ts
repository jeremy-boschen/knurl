import { useDeferredValue, useMemo } from "react"

import { computeShowableIds } from "@/lib/collection-tree-filter"
import type { Collection } from "@/types"

/**
 * Hook to compute and defer showable IDs for collection tree filtering.
 *
 * Usage in components:
 * ```tsx
 * const deferredShowableIds = useShowableIds(collection, searchTerm)
 * if (deferredShowableIds && !deferredShowableIds.has(itemId)) return null
 * ```
 *
 * How it works:
 * 1. Takes the full collection and search term
 * 2. Computes which items should be shown (via computeShowableIds)
 * 3. Uses useDeferredValue to defer the computation to a lower priority
 * 4. Returns the deferred Set of showable IDs
 *
 * Performance:
 * - The computation happens only when collection or searchTerm changes
 * - useDeferredValue defers re-renders, keeping the search input responsive
 * - Components can safely check `showableIds.has(id)` without blocking the UI
 *
 * Returns:
 * - null if no search term (everything is shown)
 * - Set<string> of showable IDs (deferred) if search term is active
 */
export function useShowableIds(collection: Collection, searchTerm: string): Set<string> | null {
  const showableIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return null
    }
    return computeShowableIds(collection, searchTerm)
  }, [collection, searchTerm])

  return useDeferredValue(showableIds)
}
