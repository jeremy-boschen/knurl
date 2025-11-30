import type { Collection, RequestState } from "@/types"

/**
 * Computes the set of showable IDs for collection tree filtering.
 *
 * Algorithm:
 * 1. Normalize the search query (trim, lowercase)
 * 2. If no query, return all IDs (nothing filtered)
 * 3. Find all matching items:
 *    - Requests matching name/method/url
 *    - Folders matching name
 *    - Collections matching name
 * 4. Include all ancestors of matches (so matching items are visible in context)
 * 5. Return Set of showable IDs
 *
 * Performance: Single pass through collection structure, O(n) where n = total items
 */
export function computeShowableIds(collection: Collection, searchTerm: string): Set<string> {
  const query = searchTerm.trim().toLowerCase()

  // If no query, show everything
  if (!query) {
    return new Set()
  }

  const showable = new Set<string>()
  const ancestors = new Set<string>()

  // Helper to mark an ID as showable and track its ancestors
  const markShowable = (itemId: string) => {
    showable.add(itemId)
  }

  // Helper to add ancestors of a folder
  const addFolderAncestors = (folderId: string) => {
    let currentId: string | null = folderId
    while (currentId !== null) {
      ancestors.add(currentId)
      const folder = collection.folders[currentId]
      currentId = folder?.parentId ?? null
    }
  }

  // Check if a string matches the query
  const matches = (value: string): boolean => value.toLowerCase().includes(query)

  // Scan requests
  for (const [requestId, request] of Object.entries(collection.requests)) {
    if (matches(request.name) || matches(request.method) || matches(request.url ?? "")) {
      markShowable(requestId)
      // Mark request's folder and all ancestors
      const folderId = request.folderId ?? ""
      if (folderId) {
        addFolderAncestors(folderId)
      }
    }
  }

  // Scan folders
  for (const [folderId, folder] of Object.entries(collection.folders)) {
    if (matches(folder.name)) {
      markShowable(folderId)
      // Mark folder's ancestors
      addFolderAncestors(folderId)
    }
  }

  // Combine showable items with their ancestors
  const result = new Set([...showable, ...ancestors])

  return result
}
