/**
 * Sorting algorithms for collection items (requests, folders, collections)
 * Supports pluggable sort strategies for future extensibility
 */

/**
 * Compares two strings using natural sort order (e.g., "item2" < "item10")
 * Falls back to locale-aware comparison for non-numeric parts
 *
 * @param a First string to compare
 * @param b Second string to compare
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function naturalSort(a: string, b: string): number {
  // Split strings into parts: alternating text and numbers
  const aParts = a.split(/(\d+)/)
  const bParts = b.split(/(\d+)/)

  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const aPart = aParts[i]
    const bPart = bParts[i]

    // Both parts are numbers - compare numerically
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const aNum = parseInt(aPart, 10)
      const bNum = parseInt(bPart, 10)
      if (aNum !== bNum) {
        return aNum - bNum
      } else {
        // Continue to next part
      }
    } else {
      // At least one part is text - use case-insensitive comparison
      // Convert to lowercase to ensure "r" < "Untitled Request" (not uppercase < lowercase)
      const aLower = aPart.toLowerCase()
      const bLower = bPart.toLowerCase()
      const cmp = aLower.localeCompare(bLower, undefined, { sensitivity: "base" })
      if (cmp !== 0) {
        return cmp
      }
    }
  }

  // If all parts are equal up to the shorter length, the shorter one comes first
  return aParts.length - bParts.length
}

/**
 * Sort strategy interface for extensibility
 */
export interface SortStrategy<T> {
  name: string
  label: string
  compare: (a: T, b: T) => number
}

/**
 * Request sorting strategies
 */
export const requestSortStrategies = {
  byName: {
    name: "byName",
    label: "Name (A-Z)",
    compare: (a: { name: string }, b: { name: string }) => naturalSort(a.name, b.name),
  },

  byMethod: {
    name: "byMethod",
    label: "HTTP Method",
    compare: (a: { method?: string }, b: { method?: string }) => {
      const methodOrder: Record<string, number> = {
        GET: 0,
        POST: 1,
        PUT: 2,
        PATCH: 3,
        DELETE: 4,
        HEAD: 5,
        OPTIONS: 6,
      }
      const aMethod = a.method?.toUpperCase() || "GET"
      const bMethod = b.method?.toUpperCase() || "GET"
      const aOrder = methodOrder[aMethod] ?? 99
      const bOrder = methodOrder[bMethod] ?? 99
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      // Then sort by name if methods are the same
      return naturalSort(a.name, b.name)
    },
  },

  byUrl: {
    name: "byUrl",
    label: "URL",
    compare: (a: { url?: string; name: string }, b: { url?: string; name: string }) => {
      const urlA = a.url || ""
      const urlB = b.url || ""
      const cmp = urlA.localeCompare(urlB, undefined, { sensitivity: "base" })
      if (cmp !== 0) {
        return cmp
      }
      // Then sort by name if URLs are the same
      return naturalSort(a.name, b.name)
    },
  },

  byUpdated: {
    name: "byUpdated",
    label: "Last Updated",
    compare: (a: { updatedAt?: number }, b: { updatedAt?: number }) => {
      // Most recently updated first
      const aTime = a.updatedAt ?? 0
      const bTime = b.updatedAt ?? 0
      return bTime - aTime
    },
  },
} as const

export type RequestSortStrategy = keyof typeof requestSortStrategies

/**
 * Folder sorting strategies
 */
export const folderSortStrategies = {
  byName: {
    name: "byName",
    label: "Name (A-Z)",
    compare: (a: { name: string }, b: { name: string }) => naturalSort(a.name, b.name),
  },
} as const

export type FolderSortStrategy = keyof typeof folderSortStrategies

/**
 * Collection sorting strategies
 */
export const collectionSortStrategies = {
  byName: {
    name: "byName",
    label: "Name (A-Z)",
    compare: (a: { name: string }, b: { name: string }) => naturalSort(a.name, b.name),
  },
} as const

export type CollectionSortStrategy = keyof typeof collectionSortStrategies
