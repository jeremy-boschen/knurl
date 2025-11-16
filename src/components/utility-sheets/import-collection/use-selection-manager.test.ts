import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useSelectionManager } from "./use-selection-manager"

import {
  createEnvironmentFixture,
  createExportedCollectionFixture,
  createRequestFixture,
  resetCollectionFixtureSeeds,
} from "@/test/fixtures/collections"

describe("useSelectionManager", () => {
  beforeEach(() => {
    resetCollectionFixtureSeeds()
  })

  it("selects all requests and environments by default", () => {
    const requestA = createRequestFixture({ id: "req-a" })
    const requestB = createRequestFixture({ id: "req-b" })
    const envA = createEnvironmentFixture({ id: "env-a" })
    const envB = createEnvironmentFixture({ id: "env-b" })

    const collection = createExportedCollectionFixture({
      requests: {
        [requestA.id]: requestA,
        [requestB.id]: requestB,
      },
      environments: {
        [envA.id]: envA,
        [envB.id]: envB,
      },
    })

    const { result } = renderHook(() => useSelectionManager(collection))

    expect(Array.from(result.current.selectedRequests)).toEqual([requestA.id, requestB.id])
    expect(Array.from(result.current.selectedEnvironments)).toEqual([envA.id, envB.id])
    expect(result.current.reqMasterState).toBe(true)
    expect(result.current.envMasterState).toBe(true)
  })

  it("updates master states as individual toggles happen", () => {
    const requestA = createRequestFixture({ id: "req-a" })
    const requestB = createRequestFixture({ id: "req-b" })
    const envA = createEnvironmentFixture({ id: "env-a" })
    const envB = createEnvironmentFixture({ id: "env-b" })

    const collection = createExportedCollectionFixture({
      requests: {
        [requestA.id]: requestA,
        [requestB.id]: requestB,
      },
      environments: {
        [envA.id]: envA,
        [envB.id]: envB,
      },
    })

    const { result } = renderHook(() => useSelectionManager(collection))

    act(() => {
      result.current.toggleRequestSelection(requestB.id, false)
      result.current.toggleEnvironmentSelection(envB.id, false)
    })

    expect(result.current.reqMasterState).toBe("indeterminate")
    expect(result.current.envMasterState).toBe("indeterminate")
    expect(Array.from(result.current.selectedRequests)).toEqual([requestA.id])
    expect(Array.from(result.current.selectedEnvironments)).toEqual([envA.id])

    act(() => {
      result.current.toggleAllRequests(false)
      result.current.toggleAllEnvironments(false)
    })

    expect(result.current.reqMasterState).toBe(false)
    expect(result.current.envMasterState).toBe(false)
    expect(result.current.selectedRequests.size).toBe(0)
    expect(result.current.selectedEnvironments.size).toBe(0)

    act(() => {
      result.current.toggleAllRequests(true)
      result.current.toggleAllEnvironments(true)
    })

    expect(result.current.reqMasterState).toBe(true)
    expect(result.current.envMasterState).toBe(true)
    expect(Array.from(result.current.selectedRequests)).toEqual([requestA.id, requestB.id])
    expect(Array.from(result.current.selectedEnvironments)).toEqual([envA.id, envB.id])
  })

  it("clears selection when collection changes to null", () => {
    const requestA = createRequestFixture({ id: "req-a" })
    const collection = createExportedCollectionFixture({
      requests: {
        [requestA.id]: requestA,
      },
    })

    const { result, rerender } = renderHook(
      ({ target }) => useSelectionManager(target),
      {
        initialProps: { target: collection },
      },
    )

    expect(result.current.selectedRequests.size).toBe(1)

    rerender({ target: null })

    expect(result.current.selectedRequests.size).toBe(0)
    expect(result.current.selectedEnvironments.size).toBe(0)
    expect(result.current.reqMasterState).toBe(false)
    expect(result.current.envMasterState).toBe(false)
  })

  it("handles collections without requests or environments", () => {
    const emptyCollection = createExportedCollectionFixture({ requests: {}, environments: {} })
    const { result } = renderHook(() => useSelectionManager(emptyCollection))

    expect(result.current.reqMasterState).toBe(false)
    expect(result.current.envMasterState).toBe(false)

    act(() => {
      result.current.toggleAllRequests(true)
      result.current.toggleAllEnvironments(true)
    })

    expect(result.current.selectedRequests.size).toBe(0)
    expect(result.current.selectedEnvironments.size).toBe(0)
  })
})
