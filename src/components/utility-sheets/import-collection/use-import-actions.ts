import { useCallback, useState } from "react"

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

  const performImport = useCallback(
    async (data: ExportedCollection, name: string, isOverwrite: boolean) => {
      try {
        setStatus(null)

        if (isOverwrite) {
          const existing = collectionsIndex.find((c) => c.name.toLowerCase() === name.toLowerCase())
          if (existing) {
            await collectionsApi().removeCollection(existing.id)
          }
        }

        const filteredData = JSON.parse(JSON.stringify(data)) as ExportedCollection

        filteredData.collection.requests = Object.fromEntries(
          Object.entries(data.collection.requests ?? {}).filter(([id]) => selectedRequests.has(id)),
        )

        filteredData.collection.environments = Object.fromEntries(
          Object.entries(data.collection.environments ?? {}).filter(([id]) => selectedEnvironments.has(id)),
        )

        const newCollection = await collectionsApi().importCollection(filteredData, name)
        const importedRequests = Object.keys(newCollection.requests ?? {}).length
        const importedEnvironments = Object.keys(newCollection.environments ?? {}).length

        setStatus({
          kind: "success",
          message: `Imported "${newCollection.name}" with ${importedRequests} requests and ${importedEnvironments} environments.`,
        })
        return true
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error)?.message ?? "An unknown error occurred." })
        return false
      }
    },
    [collectionsApi, collectionsIndex, selectedRequests, selectedEnvironments],
  )

  const handleImport = useCallback(
    async (name: string) => {
      if (!collection) {
        setStatus({ kind: "error", message: "No valid collection data to import." })
        return
      }
      await performImport(collection, name, false)
    },
    [collection, performImport],
  )

  const handleOverwrite = useCallback(
    async (name: string) => {
      if (!collection) {
        setStatus({ kind: "error", message: "No valid collection data to import." })
        return
      }
      await performImport(collection, name, true)
    },
    [collection, performImport],
  )

  return {
    status,
    setStatus,
    handleImport,
    handleOverwrite,
  }
}
