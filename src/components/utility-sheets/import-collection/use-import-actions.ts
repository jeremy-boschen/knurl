import { useCallback, useState } from "react"

import { RootCollectionFolderId } from "@/types"
import { useCollections } from "@/state"
import type { ExportedCollection } from "@/types"

export function useImportActions(
  collection: ExportedCollection | null,
  selectedRequests: Set<string>,
  selectedEnvironments: Set<string>,
) {
  const {
    state: { collectionsIndex },
    actions: { collectionsApi },
  } = useCollections()
  const [status, setStatus] = useState<{ kind: "success" | "error"; message?: string } | null>(null)

  const buildFilteredExport = useCallback((): ExportedCollection | null => {
    if (!collection) {
      return null
    }

    const cloned = JSON.parse(JSON.stringify(collection)) as ExportedCollection

    cloned.collection.requests = Object.fromEntries(
      Object.entries(collection.collection.requests ?? {}).filter(([id]) => selectedRequests.has(id)),
    )

    cloned.collection.environments = Object.fromEntries(
      Object.entries(collection.collection.environments ?? {}).filter(([id]) => selectedEnvironments.has(id)),
    )

    const originalFolders = collection.collection.folders ?? {}
    const referencedFolderIds = new Set<string>([RootCollectionFolderId])

    const trackFolder = (folderId: string | undefined) => {
      const target = folderId && originalFolders[folderId] ? folderId : RootCollectionFolderId
      let current: string | null | undefined = target
      const safety = Object.keys(originalFolders).length + 2
      let guard = 0
      while (current && current !== RootCollectionFolderId && guard < safety) {
        referencedFolderIds.add(current)
        current = originalFolders[current]?.parentId ?? RootCollectionFolderId
        guard += 1
      }
      referencedFolderIds.add(RootCollectionFolderId)
    }

    for (const [id] of Object.entries(cloned.collection.requests ?? {})) {
      const originalRequest = collection.collection.requests?.[id]
      trackFolder(originalRequest?.folderId ?? cloned.collection.requests?.[id]?.folderId)
    }

    cloned.collection.folders = Object.fromEntries(
      Object.entries(originalFolders).filter(([id]) => referencedFolderIds.has(id)),
    )

    return cloned
  }, [collection, selectedEnvironments, selectedRequests])

  const handleImport = useCallback(
    async (name: string) => {
      const filtered = buildFilteredExport()
      if (!filtered) {
        setStatus({ kind: "error", message: "No valid collection data to import." })
        return
      }

      try {
        setStatus(null)
        const newCollection = await collectionsApi().importCollection(filtered, name)
        const importedRequests = Object.keys(newCollection.requests ?? {}).length
        const importedEnvironments = Object.keys(newCollection.environments ?? {}).length
        setStatus({
          kind: "success",
          message: `Imported "${newCollection.name}" with ${importedRequests} requests and ${importedEnvironments} environments.`,
        })
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error)?.message ?? "An unknown error occurred." })
      }
    },
    [buildFilteredExport, collectionsApi],
  )

  const handleOverwrite = useCallback(
    async (name: string) => {
      const filtered = buildFilteredExport()
      if (!filtered) {
        setStatus({ kind: "error", message: "No valid collection data to import." })
        return
      }

      const existing = collectionsIndex.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (!existing) {
        setStatus({ kind: "error", message: `Collection "${name}" was not found.` })
        return
      }

      try {
        setStatus(null)
        await collectionsApi().removeCollection(existing.id)
        const newCollection = await collectionsApi().importCollection(filtered, name)
        const importedRequests = Object.keys(newCollection.requests ?? {}).length
        const importedEnvironments = Object.keys(newCollection.environments ?? {}).length
        setStatus({
          kind: "success",
          message: `Replaced "${newCollection.name}" with ${importedRequests} requests and ${importedEnvironments} environments.`,
        })
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error)?.message ?? "An unknown error occurred." })
      }
    },
    [buildFilteredExport, collectionsApi, collectionsIndex],
  )

  const handleMerge = useCallback(
    async (name: string) => {
      const filtered = buildFilteredExport()
      if (!filtered) {
        setStatus({ kind: "error", message: "No valid collection data to import." })
        return
      }

      const existing = collectionsIndex.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (!existing) {
        setStatus({ kind: "error", message: `Collection "${name}" was not found.` })
        return
      }

      try {
        setStatus(null)
        const result = await collectionsApi().mergeCollection(existing.id, filtered)
        setStatus({
          kind: "success",
          message: `Merged into "${name}" (${result.updatedRequests} updated, ${result.addedRequests} added requests; ${result.updatedEnvironments} updated, ${result.addedEnvironments} added environments).`,
        })
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error)?.message ?? "An unknown error occurred." })
      }
    },
    [buildFilteredExport, collectionsApi, collectionsIndex],
  )

  return {
    status,
    setStatus,
    handleImport,
    handleOverwrite,
    handleMerge,
  }
}
