import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CollectionsIndexEntry } from "@/types"
import { RootCollectionFolderId } from "@/types"
import {
  createEnvironmentFixture,
  createExportedCollectionFixture,
  createFolderFixture,
  createRequestFixture,
  resetCollectionFixtureSeeds,
} from "@/test/fixtures/collections"
import { useImportActions } from "./use-import-actions"
import { useCollections } from "@/state"

vi.mock("@/state", () => ({
  useCollections: vi.fn(),
}))

const mockedUseCollections = vi.mocked(useCollections)

const mockCollectionsApi = {
  importCollection: vi.fn(),
  removeCollection: vi.fn(),
  mergeCollection: vi.fn(),
}

const collectionsApiAccessor = vi.fn(() => mockCollectionsApi)
const collectionsIndex: CollectionsIndexEntry[] = []

describe("useImportActions", () => {
  beforeEach(() => {
    resetCollectionFixtureSeeds()
    mockCollectionsApi.importCollection.mockReset()
    mockCollectionsApi.removeCollection.mockReset()
    mockCollectionsApi.mergeCollection.mockReset()
    collectionsApiAccessor.mockClear()
    collectionsIndex.splice(0, collectionsIndex.length)

    mockedUseCollections.mockReturnValue({
      state: { collectionsIndex },
      actions: { collectionsApi: collectionsApiAccessor },
    })
  })

  it("filters export payload down to the selected entities before importing", () => {
    const keptRequest = createRequestFixture({ id: "req-keep", folderId: "folder-keep" })
    const droppedRequest = createRequestFixture({ id: "req-drop", folderId: "folder-drop" })
    const keptEnvironment = createEnvironmentFixture({ id: "env-keep" })
    const droppedEnvironment = createEnvironmentFixture({ id: "env-drop" })
    const rootFolder = createFolderFixture({ id: RootCollectionFolderId, parentId: null })
    const keptFolder = createFolderFixture({
      id: keptRequest.folderId,
      parentId: RootCollectionFolderId,
      requestIds: [keptRequest.id],
    })
    const droppedFolder = createFolderFixture({
      id: droppedRequest.folderId,
      parentId: RootCollectionFolderId,
      requestIds: [droppedRequest.id],
    })

    const exportPayload = createExportedCollectionFixture({
      requests: {
        [keptRequest.id]: keptRequest,
        [droppedRequest.id]: droppedRequest,
      },
      environments: {
        [keptEnvironment.id]: keptEnvironment,
        [droppedEnvironment.id]: droppedEnvironment,
      },
      folders: {
        [rootFolder.id]: rootFolder,
        [keptFolder.id]: keptFolder,
        [droppedFolder.id]: droppedFolder,
      },
    })

    mockCollectionsApi.importCollection.mockImplementation((payload, name: string) => ({
      name,
      requests: payload.collection?.requests ?? {},
      environments: payload.collection?.environments ?? {},
    }))

    const selectedRequests = new Set([keptRequest.id])
    const selectedEnvironments = new Set([keptEnvironment.id])

    const { result } = renderHook(() => useImportActions(exportPayload, selectedRequests, selectedEnvironments))

    act(() => {
      result.current.handleImport("Workspace Copy")
    })

    expect(mockCollectionsApi.importCollection).toHaveBeenCalledTimes(1)
    const [filteredExport, providedName] = mockCollectionsApi.importCollection.mock.calls[0]
    expect(providedName).toBe("Workspace Copy")

    expect(Object.keys(filteredExport.collection?.requests ?? {})).toEqual([keptRequest.id])
    expect(Object.keys(filteredExport.collection?.environments ?? {})).toEqual([keptEnvironment.id])
    expect(Object.keys(filteredExport.collection?.folders ?? {})).toEqual([RootCollectionFolderId, keptFolder.id])

    expect(result.current.status?.kind).toBe("success")
    expect(result.current.status?.message).toContain('Imported "Workspace Copy" with 1 requests and 1 environments.')
  })

  it("reports an error when trying to import without a collection", () => {
    const { result } = renderHook(() => useImportActions(null, new Set(), new Set()))

    act(() => {
      result.current.handleImport("Untitled")
    })

    expect(mockCollectionsApi.importCollection).not.toHaveBeenCalled()
    expect(result.current.status).toEqual({
      kind: "error",
      message: "No valid collection data to import.",
    })
  })

  it("rejects overwrite/merge attempts when the target collection does not exist", () => {
    collectionsIndex.splice(0, collectionsIndex.length, { id: "abc", name: "Alpha", count: 0 })

    const sample = createExportedCollectionFixture()
    const { result } = renderHook(() => useImportActions(sample, new Set(), new Set()))

    act(() => {
      result.current.handleOverwrite("Missing")
    })
    expect(result.current.status).toEqual({
      kind: "error",
      message: 'Collection "Missing" was not found.',
    })

    act(() => {
      result.current.handleMerge("Missing")
    })
    expect(result.current.status).toEqual({
      kind: "error",
      message: 'Collection "Missing" was not found.',
    })
  })

  it("overwrites an existing collection by deleting then importing", () => {
    collectionsIndex.splice(0, collectionsIndex.length, { id: "abc", name: "Target", count: 0 })

    mockCollectionsApi.importCollection.mockReturnValue({
      name: "Target",
      requests: { one: {} },
      environments: {},
    })

    const sample = createExportedCollectionFixture()
    const { result } = renderHook(() => useImportActions(sample, new Set(), new Set()))

    act(() => {
      result.current.handleOverwrite("target")
    })

    expect(mockCollectionsApi.removeCollection).toHaveBeenCalledWith("abc")
    expect(mockCollectionsApi.importCollection).toHaveBeenCalledTimes(1)
    expect(result.current.status?.message).toContain('Replaced "Target" with 1 requests and 0 environments.')

    const removeOrder = mockCollectionsApi.removeCollection.mock.invocationCallOrder[0]
    const importOrder = mockCollectionsApi.importCollection.mock.invocationCallOrder[0]
    expect(removeOrder).toBeLessThan(importOrder)
  })

  it("merges into an existing collection and surfaces the summary", () => {
    collectionsIndex.splice(0, collectionsIndex.length, { id: "abc", name: "Workspace", count: 0 })

    mockCollectionsApi.mergeCollection.mockReturnValue({
      updatedRequests: 1,
      addedRequests: 2,
      updatedEnvironments: 0,
      addedEnvironments: 1,
    })

    const sample = createExportedCollectionFixture()
    const { result } = renderHook(() => useImportActions(sample, new Set(), new Set()))

    act(() => {
      result.current.handleMerge("Workspace")
    })

    expect(mockCollectionsApi.mergeCollection).toHaveBeenCalledWith("abc", expect.any(Object))
    expect(result.current.status?.kind).toBe("success")
    expect(result.current.status?.message).toContain(
      'Merged into "Workspace" (1 updated, 2 added requests; 0 updated, 1 added environments).',
    )
  })

  it("captures thrown errors from API calls", () => {
    mockCollectionsApi.importCollection.mockImplementation(() => {
      throw new Error("Import failed")
    })
    const sample = createExportedCollectionFixture()
    const { result } = renderHook(() => useImportActions(sample, new Set(), new Set()))

    act(() => {
      result.current.handleImport("Broken")
    })

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Import failed",
    })
  })
})
