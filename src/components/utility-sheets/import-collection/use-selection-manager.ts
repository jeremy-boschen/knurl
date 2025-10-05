import type React from "react"
import { useEffect, useMemo, useState } from "react"

import type { ExportedCollection } from "@/types"

export function useSelectionManager(collection: ExportedCollection | null) {
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [selectedEnvironments, setSelectedEnvironments] = useState<Set<string>>(new Set())

  const requests = useMemo(() => Object.values(collection?.collection.requests ?? {}), [collection])
  const environments = useMemo(() => Object.values(collection?.collection.environments ?? {}), [collection])

  useEffect(() => {
    if (collection) {
      const allRequestIds = Object.keys(collection.collection.requests ?? {})
      const allEnvIds = Object.keys(collection.collection.environments ?? {})
      setSelectedRequests(new Set(allRequestIds))
      setSelectedEnvironments(new Set(allEnvIds))
    } else {
      setSelectedRequests(new Set())
      setSelectedEnvironments(new Set())
    }
  }, [collection])

  const reqMasterState: boolean | "indeterminate" = useMemo(() => {
    if (requests.length === 0) {
      return false
    }
    return selectedRequests.size === 0 ? false : selectedRequests.size === requests.length ? true : "indeterminate"
  }, [selectedRequests, requests])

  const envMasterState: boolean | "indeterminate" = useMemo(() => {
    if (environments.length === 0) {
      return false
    }
    return selectedEnvironments.size === 0
      ? false
      : selectedEnvironments.size === environments.length
        ? true
        : "indeterminate"
  }, [selectedEnvironments, environments])

  const toggleSelection = (
    set: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    checked: boolean,
  ) => {
    const next = new Set(set)
    checked ? next.add(id) : next.delete(id)
    setter(next)
  }

  const toggleRequestSelection = (id: string, checked: boolean) => {
    toggleSelection(selectedRequests, setSelectedRequests, id, checked)
  }

  const toggleAllRequests = (check: boolean) => {
    setSelectedRequests(check ? new Set(requests.filter((r) => r.id).map((r) => r.id)) : new Set())
  }

  const toggleEnvironmentSelection = (id: string, checked: boolean) => {
    toggleSelection(selectedEnvironments, setSelectedEnvironments, id, checked)
  }

  const toggleAllEnvironments = (check: boolean) => {
    setSelectedEnvironments(check ? new Set(environments.filter((e) => e.id).map((e) => e.id)) : new Set())
  }

  return {
    requests,
    environments,
    selectedRequests,
    selectedEnvironments,
    reqMasterState,
    envMasterState,
    toggleRequestSelection,
    toggleAllRequests,
    toggleEnvironmentSelection,
    toggleAllEnvironments,
  }
}
