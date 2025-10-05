// Consolidated test suite for src/state/collections.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useApplication } from "@/state/application"
import { RootCollectionFolderId, ScratchCollectionId } from "@/types"
import { saveScratchRequest } from "@/state/collections"

// ------- from collections.crud.test.ts -------
describe("collections CRUD", () => {
  it("addCollection creates a new index entry", async () => {
    const { collectionsApi } = useApplication.getState()
    const before = useApplication.getState().collectionsState.index.length
    const col = await collectionsApi.addCollection("My Col", "Desc")
    const after = useApplication.getState().collectionsState.index.length
    expect(after).toBe(before + 1)
    expect(col.name).toBe("My Col")
  })

  it("updateCollection updates index name", async () => {
    const { collectionsApi } = useApplication.getState()
    const [entry] = useApplication.getState().collectionsState.index
    await collectionsApi.updateCollection(entry.id, { name: "Renamed" })
    const updated = useApplication.getState().collectionsState.index.find((e) => e.id === entry.id)!
    expect(updated.name).toBe("Renamed")
  })

  it("removeCollection updates index", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Temp", "")
    const len = useApplication.getState().collectionsState.index.length
    await collectionsApi.removeCollection(col.id)
    const len2 = useApplication.getState().collectionsState.index.length
    expect(len2).toBe(len - 1)
  })
})

// ------- from collections.patch.test.ts -------
describe("collections patch helpers", () => {
  it("updateRequestPatchHeader adds a header to patch", async () => {
    const { collectionsApi } = useApplication.getState()
    const [meta] = useApplication.getState().collectionsState.index
    let colId = meta?.id
    if (!colId) {
      const col = await collectionsApi.addCollection("T")
      colId = col.id
    }
    await collectionsApi.getCollection(colId!)
    const req = await collectionsApi.createRequest(colId!, { name: "Patch", url: "" })
    await collectionsApi.updateRequestPatchHeader(colId!, req.id, "h1", { name: "X-Test", value: "1", enabled: true })
    const updated = await collectionsApi.getRequest(colId!, req.id)
    expect(updated.patch?.headers?.h1).toBeTruthy()
    expect(updated.patch?.headers?.h1?.name).toBe("X-Test")
  })

  it("updateRequestPatchQueryParam adds/removes param", async () => {
    const { collectionsApi } = useApplication.getState()
    let [meta] = useApplication.getState().collectionsState.index
    if (!meta) {
      const col = await collectionsApi.addCollection("T2")
      meta = { id: col.id } as any
    }
    await collectionsApi.getCollection(meta.id)
    const req = await collectionsApi.createRequest(meta.id, { name: "QP", url: "" })
    await collectionsApi.updateRequestPatchQueryParam(meta.id, req.id, "q1", { name: "a", value: "1", enabled: true })
    let updated = await collectionsApi.getRequest(meta.id, req.id)
    expect(updated.patch?.queryParams?.q1).toBeTruthy()
    await collectionsApi.updateRequestPatchQueryParam(meta.id, req.id, "q1", null)
    updated = await collectionsApi.getRequest(meta.id, req.id)
    expect(updated.patch?.queryParams?.q1).toBeUndefined()
  })

  it("preserves untouched headers when patching a single header", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Patch Preserve")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      headers: {
        h1: { id: "h1", name: "A", value: "1", enabled: true },
        h2: { id: "h2", name: "B", value: "2", enabled: true },
      },
    } as any)
    await collectionsApi.commitRequestPatch(col.id, req.id)

    await collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", { value: "99" })
    const updated = await collectionsApi.getRequest(col.id, req.id)
    expect(updated.patch?.headers?.h1?.value).toBe("99")
    expect(updated.patch?.headers?.h2?.value).toBe("2")
  })

  it("preserves sibling path params when editing one", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Path Preserve")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    await collectionsApi.updateRequest(col.id, req.id, {
      pathParams: {
        p1: { id: "p1", name: "Foo", value: "1", enabled: true, secure: false },
        p2: { id: "p2", name: "Bar", value: "2", enabled: true, secure: false },
      },
    })

    await collectionsApi.updateRequestPatchPathParam(col.id, req.id, "p1", { value: "99" })
    const patched = await collectionsApi.getRequest(col.id, req.id)
    expect(patched.patch?.pathParams?.p1?.value).toBe("99")
    expect(patched.patch?.pathParams?.p2?.value).toBe("2")

    await collectionsApi.commitRequestPatch(col.id, req.id)
    const committed = await collectionsApi.getRequest(col.id, req.id)
    expect(committed.pathParams?.p1?.value).toBe("99")
    expect(committed.pathParams?.p2?.value).toBe("2")
  })
})

describe("collections patch and merge logic", () => {
  it("primitive patch fields are added/removed based on equality to base", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("P")
    const req = await collectionsApi.createRequest(col.id, { name: "R", url: "" })
    // No-op change should not persist in patch
    await collectionsApi.updateRequestPatch(col.id, req.id, { name: "R" })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.name).toBeUndefined()
    // Actual change persists in patch
    await collectionsApi.updateRequestPatch(col.id, req.id, { name: "R2" })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.name).toBe("R2")
    // Changing back to base removes patch entry
    await collectionsApi.updateRequestPatch(col.id, req.id, { name: "R" })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.name).toBeUndefined()
  })

  it("headers/add-update-delete and equality cleanup work as expected", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("H")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    await collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", { name: "A", value: "1", enabled: true })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers?.h1?.value).toBe("1")
    // Update value; remains in patch
    await collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", { value: "2" })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers?.h1?.value).toBe("2")
    // Commit patch then remove; equality cleanup should clear headers from patch
    await collectionsApi.commitRequestPatch(col.id, req.id)
    await collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", { value: "2" }) // equal to base now
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers).toBeUndefined()
  })

  it("body formData via generic update: remove differs from base (kept), adding back equal via generic update cleans patch", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("B")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    // Add formData via patch body
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      body: { formData: { f1: { id: "f1", key: "k", value: "v", enabled: true, secure: false, kind: "text" as any } } },
    })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.formData?.f1?.value).toBe("v")
    // Commit to base
    await collectionsApi.commitRequestPatch(col.id, req.id)
    // Remove f1 via patch => differs from base so patch is kept
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      body: { formData: { f1: undefined } },
    })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.formData).toEqual({})
    // Add it back equal to base using generic update (no equality cleanup here)
    const baseNow = await collectionsApi.getRequest(col.id, req.id)
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      body: { formData: structuredClone(baseNow.body.formData ?? {}) },
    } as any)
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("body formData via dedicated API: adding back equal cleans patch", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("B2")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      body: { formData: { f1: { id: "f1", key: "k", value: "v", enabled: true, secure: false } } },
    })
    await collectionsApi.commitRequestPatch(col.id, req.id)
    // Remove then add back using the specialized helper (which performs equality cleanup)
    await collectionsApi.updateRequestPatchFormData(col.id, req.id, "f1", null)
    const baseNow = await collectionsApi.getRequest(col.id, req.id)
    await collectionsApi.updateRequestPatchFormData(col.id, req.id, "f1", baseNow.body.formData?.f1 as any)
    const r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("generic body equality cleanup on content/type/language/encoding", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("BODY")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    // Seed base body
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      body: { type: "text" as any, content: "A", language: "json" as any, encoding: "url" as any },
    })
    await collectionsApi.commitRequestPatch(col.id, req.id)

    // No-op (equal) should clear patch
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { content: "A" } })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Change and then change back clears patch
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { content: "B" } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.content).toBe("B")
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { content: "A" } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Type flip-back cleanup: change then change back
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { type: "binary" as any } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.type).toBe("binary")
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { type: "text" as any } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Language flip-back cleanup
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { language: "yaml" as any } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.language).toBe("yaml")
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { language: "json" as any } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Encoding flip-back cleanup
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { encoding: "multipart" as any } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.encoding).toBe("multipart")
    await collectionsApi.updateRequestPatch(col.id, req.id, { body: { encoding: "url" as any } })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("options shallow merge in patch and commit update the base, then clear patch", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("O")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    await collectionsApi.updateRequestPatch(col.id, req.id, { options: { timeoutSecs: 10, userAgent: "UA" } as any })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.options?.timeoutSecs).toBe(10)
    expect(r.patch?.options?.userAgent).toBe("UA")
    await collectionsApi.commitRequestPatch(col.id, req.id)
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.options?.timeoutSecs).toBe(10)
    expect(r.options?.userAgent).toBe("UA")
    expect(r.patch).toEqual({})
  })

  it("generic headers: flip back to equality cleans patch", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("HDR")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    // Add header via generic update and commit to base
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      headers: { h1: { id: "h1", name: "A", value: "1", enabled: true, secure: false } as any },
    })
    await collectionsApi.commitRequestPatch(col.id, req.id)
    // No-op equal update should clear patch
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      headers: { h1: { id: "h1", name: "A", value: "1", enabled: true, secure: false } as any },
    })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
    // Remove differs -> keep patch, then add back equal -> clear
    await collectionsApi.updateRequestPatch(col.id, req.id, { headers: { h1: undefined } as any })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers).toBeDefined()
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      headers: { h1: { id: "h1", name: "A", value: "1", enabled: true, secure: false } as any },
    })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("generic query params: flip back to equality cleans patch", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("QRY")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      queryParams: { q1: { id: "q1", name: "a", value: "1", enabled: true, secure: false } as any },
    })
    await collectionsApi.commitRequestPatch(col.id, req.id)
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      queryParams: { q1: { id: "q1", name: "a", value: "1", enabled: true, secure: false } as any },
    })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
    await collectionsApi.updateRequestPatch(col.id, req.id, { queryParams: { q1: undefined } as any })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.queryParams).toBeDefined()
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      queryParams: { q1: { id: "q1", name: "a", value: "1", enabled: true, secure: false } as any },
    })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("generic path params: flip back to equality cleans patch", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("PATH")
    const req = await collectionsApi.createRequest(col.id, { name: "R" })
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      pathParams: { p1: { id: "p1", name: "id", value: "42", enabled: true, secure: false } as any },
    })
    await collectionsApi.commitRequestPatch(col.id, req.id)
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      pathParams: { p1: { id: "p1", name: "id", value: "42", enabled: true, secure: false } as any },
    })
    let r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
    await collectionsApi.updateRequestPatch(col.id, req.id, { pathParams: { p1: undefined } as any })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.pathParams).toBeDefined()
    await collectionsApi.updateRequestPatch(col.id, req.id, {
      pathParams: { p1: { id: "p1", name: "id", value: "42", enabled: true, secure: false } as any },
    })
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("auth type change in patch removes old type data after commit", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("A")
    const req = await collectionsApi.createRequest(col.id, { name: "R", authentication: { type: "bearer", bearer: { token: "T" } } as any })
    await collectionsApi.updateRequestPatch(col.id, req.id, { authentication: { type: "basic", basic: { username: "u" } } as any })
    let r = await collectionsApi.getRequest(col.id, req.id)
    // Merge view: type reflects patch
    expect((r.patch?.authentication as any).type).toBe("basic")
    await collectionsApi.commitRequestPatch(col.id, req.id)
    r = await collectionsApi.getRequest(col.id, req.id)
    expect(r.authentication.type).toBe("basic")
    expect((r.authentication as any).basic.username).toBe("u")
    expect((r.authentication as any).bearer).toBeUndefined()
  })
})

// ------- from collections.sanitize.test.ts -------
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: "main" }),
}))
import type { CollectionCacheState, RequestState } from "@/types"
import { RootCollectionFolderId } from "@/types"
import { sanitizeCollection } from "@/state/collections"
const baseCollection = (): CollectionCacheState => ({
  id: "col-1",
  name: "Test",
  updated: new Date().toISOString(),
  encryption: { algorithm: "aes-gcm", key: undefined },
  environments: {},
  requests: {},
  folders: {
    [RootCollectionFolderId]: {
      id: RootCollectionFolderId,
      name: "Root",
      parentId: null,
      order: 0,
      childFolderIds: [],
      requestIds: [],
    },
  },
  requestIndex: {},
  authentication: { type: "none" },
})
const req = (overrides: Partial<RequestState>): RequestState => ({
  id: "req-1",
  name: "R1",
  collectionId: "col-1",
  folderId: RootCollectionFolderId,
  autoSave: false,
  method: "GET",
  url: "https://example.com",
  pathParams: {},
  queryParams: {},
  headers: {},
  body: { type: "none" },
  authentication: { type: "none" },
  options: {},
  patch: {},
  updated: 0,
  ...overrides,
})
describe("sanitizeCollection", () => {
  it("redacts bearer tokens from collection and requests including patches", () => {
    const col = baseCollection()
    col.authentication = {
      type: "bearer",
      bearer: { token: "COL_TOKEN", scheme: "Bearer", placement: { type: "header", name: "Authorization" } },
    } as any
    col.requests = {
      "req-1": req({
        authentication: {
          type: "bearer",
          bearer: { token: "REQ_TOKEN", scheme: "Bearer", placement: { type: "header", name: "Authorization" } },
        } as any,
        patch: {
          authentication: {
            type: "bearer",
            bearer: { token: "PATCH_TOKEN", scheme: "Bearer", placement: { type: "header", name: "Authorization" } },
          } as any,
        },
      }),
    }
    col.folders[RootCollectionFolderId].requestIds = ["req-1"]
    col.requestIndex["req-1"] = { folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId] }
    const sanitized = sanitizeCollection(col)
    expect((sanitized.authentication as any).bearer.token).toBeUndefined()
    const r = sanitized.requests["req-1"]!
    expect((r.authentication as any).bearer.token).toBeUndefined()
    expect((r.patch!.authentication as any).bearer.token).toBeUndefined()
  })

  it("leaves non-bearer auth intact (e.g., basic, oauth2)", () => {
    const col = baseCollection()
    col.authentication = { type: "basic", basic: { username: "u", password: "p" } } as any
    col.requests = {
      "req-1": req({
        authentication: { type: "oauth2", oauth2: { clientId: "cid", clientSecret: "cs" } as any },
        patch: { authentication: { type: "basic", basic: { username: "u2", password: "p2" } } as any },
      }),
    }
    col.folders[RootCollectionFolderId].requestIds = ["req-1"]
    col.requestIndex["req-1"] = { folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId] }
    const sanitized = sanitizeCollection(col)
    expect((sanitized.authentication as any).basic.password).toBe("p")
    const r = sanitized.requests["req-1"]!
    expect((r.authentication as any).oauth2.clientSecret).toBe("cs")
    expect((r.patch!.authentication as any).basic.password).toBe("p2")
  })
})

// ------- from collections.import.test.ts -------
import { createStore } from "zustand"
import { immer } from "zustand/middleware/immer"
import { subscribeWithSelector } from "zustand/middleware"
import { enablePatches } from "immer"
import { withStorageManager } from "@/types/middleware/storage-manager"
import type { ApplicationState } from "@/types/application"
import { RootCollectionFolderId } from "@/types"
import { createCollectionsSlice, ScratchCollectionId } from "./collections"
import * as bindings from "@/bindings/knurl"
const createTestStore = () =>
  createStore<ApplicationState>()(
    withStorageManager(
      immer(
        subscribeWithSelector((set, get, store) => ({
          ...createCollectionsSlice(set, get, store as any),
        })),
      ),
    ),
  )
describe("Collections import/migration", () => {
  let store: ReturnType<typeof createTestStore>
  beforeEach(() => {
    enablePatches()
    store = createTestStore()
    ;(store as any).broadcastPatch = () => {}
  })

  it("defaults missing authentication to none on import", async () => {
    const { collectionsApi } = store.getState()

    const imported = await collectionsApi.importCollection(
      {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: {
          id: "legacy-without-auth",
          name: "Legacy",
          updated: new Date().toISOString(),
          encryption: { algorithm: "aes-gcm" },
          environments: {},
          requests: {},
        },
      },
      "Imported",
    )

    const loaded = await collectionsApi.getCollection(imported.id)
    expect(loaded.authentication.type).toBe("none")
    expect(loaded.id).not.toBe(ScratchCollectionId)
  })

  it("coerces collection-level inherit auth to none on import", async () => {
    const { collectionsApi } = store.getState()
    const imported = await collectionsApi.importCollection(
      {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: {
          id: "legacy-col",
          name: "Legacy",
          updated: new Date().toISOString(),
          encryption: { algorithm: "aes-gcm" },
          environments: {},
          requests: {},
          authentication: { type: "inherit" as any },
        },
      },
      "Imported",
    )
    const loaded = await collectionsApi.getCollection(imported.id)
    expect(loaded.authentication.type).toBe("none")
    expect(loaded.id).not.toBe(ScratchCollectionId)
  })

  it("round-trips nested folders and requests through export/import", async () => {
    const { collectionsApi } = store.getState()

    const original = await collectionsApi.addCollection("Original")
    const parentFolder = await collectionsApi.createFolder(original.id, RootCollectionFolderId, "Group")
    const childFolder = await collectionsApi.createFolder(original.id, parentFolder.id, "Nested")

    await collectionsApi.createRequest(original.id, {
      name: "Root Request",
      method: "GET",
      url: "https://example.com/root",
    })

    await collectionsApi.createRequest(original.id, {
      name: "Nested Request",
      method: "POST",
      url: "https://example.com/nested",
      folderId: childFolder.id,
    })

    const exported = await collectionsApi.exportCollection(original.id)
    const imported = await collectionsApi.importCollection(exported, "Imported Copy")
    const loaded = await collectionsApi.getCollection(imported.id)

    const importedParent = loaded.folders[parentFolder.id]
    expect(importedParent).toBeDefined()
    expect(importedParent.childFolderIds).toContain(childFolder.id)

    const importedChild = loaded.folders[childFolder.id]
    expect(importedChild).toBeDefined()
    expect(importedChild.childFolderIds).toHaveLength(0)
    expect(importedChild.requestIds).toHaveLength(1)

    const nestedRequest = loaded.requests[importedChild.requestIds[0]]
    expect(nestedRequest).toBeDefined()
    expect(nestedRequest?.name).toBe("Nested Request")
    expect(nestedRequest?.folderId).toBe(childFolder.id)

    const importedRootFolder = loaded.folders[RootCollectionFolderId]
    const rootRequest = importedRootFolder.requestIds.map((id) => loaded.requests[id]).find((r) => r?.name === "Root Request")
    expect(rootRequest).toBeDefined()
    expect(rootRequest?.folderId).toBe(RootCollectionFolderId)
  })
})

// ------- focused regression test: empty patch stays empty on load -------
describe("Collection load preserves empty request.patch", () => {
  it("does not inject defaulted fields (e.g., autoSave) into an empty patch on load", async () => {
    const store = createTestStore()
    ;(store as any).broadcastPatch = () => {}

    const colId = "col-load-1"
    const reqId = "req-load-1"

    // Make the collection discoverable by getCollection via index
    store.setState((s) => {
      s.collectionsState.index = [
        { id: colId, name: "Loaded", count: 1, updated: new Date().toISOString() } as any,
      ]
    })

    // Mock loadAppData to return a collection with an empty patch {}
    const spy = vi.spyOn(bindings, "loadAppData").mockImplementation(async (fileName: string) => {
      if (fileName === `collections/${colId}.json`) {
        return {
          header: { version: 1, updated: new Date().toISOString() },
          content: {
            id: colId,
            name: "Loaded",
            updated: new Date().toISOString(),
            encryption: { algorithm: "aes-gcm" },
            environments: {},
            requests: {
              [reqId]: {
                id: reqId,
                name: "R",
                collectionId: colId,
                autoSave: true,
                method: "GET",
                url: "https://example.com",
                pathParams: {},
                queryParams: {},
                headers: {},
                body: { type: "none" },
                authentication: { type: "none" },
                options: {},
                patch: {},
                updated: 0,
              },
            },
            authentication: { type: "none" },
          },
        } as any
      }
      // Index or other files: let default mocked IPC handle or return null
      return null as any
    })

    const { collectionsApi } = store.getState()
    const loaded = await collectionsApi.getCollection(colId)
    const r = loaded.requests[reqId]
    expect(r).toBeTruthy()
    // Patch must remain strictly empty and not materialize defaults
    expect(r.patch).toEqual({})
    expect((r.patch as any).autoSave).toBeUndefined()

    spy.mockRestore()
  })
})
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    label: "main",
    onCloseRequested: vi.fn(async () => () => {}),
  }),
}))
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: "main" }),
}))

// ------- from collections.order.test.ts -------
describe("collections and requests ordering", () => {
  it("assigns increasing order to new collections and supports reordering", async () => {
    const { collectionsApi } = useApplication.getState()
    const a = await collectionsApi.addCollection("A")
    const b = await collectionsApi.addCollection("B")
    const c = await collectionsApi.addCollection("C")
    const index = useApplication.getState().collectionsState.index.filter((e) => e.id !== "scratch")
    const ea = index.find((e) => e.id === a.id)!
    const eb = index.find((e) => e.id === b.id)!
    const ec = index.find((e) => e.id === c.id)!
    expect(ea.order).toBeLessThan(eb.order!)
    expect(eb.order).toBeLessThan(ec.order!)
    await collectionsApi.reorderCollections([b.id, a.id, c.id])
    const ix2 = useApplication.getState().collectionsState.index.filter((e) => e.id !== "scratch")
    const ids2 = ix2.map((e) => e.id)
    expect(ids2.slice(0, 3)).toEqual([b.id, a.id, c.id])
    // Orders start from 0 for collections (scratch collection is excluded above)
    expect(ix2[0].order).toBe(0)
    expect(ix2[1].order).toBe(1)
    expect(ix2[2].order).toBe(2)
  })

  it("assigns increasing order to new requests and supports reordering", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Order Test")
    const r1 = await collectionsApi.createRequest(col.id, { name: "r1" })
    const r2 = await collectionsApi.createRequest(col.id, { name: "r2" })
    const r3 = await collectionsApi.createRequest(col.id, { name: "r3" })
    const reqs = Object.values(useApplication.getState().collectionsState.cache[col.id]!.requests)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    expect(reqs.map((r) => r.id)).toEqual([r1.id, r2.id, r3.id])
    await collectionsApi.reorderRequestsInFolder(col.id, RootCollectionFolderId, [r3.id, r1.id, r2.id])
    const reqs2 = Object.values(useApplication.getState().collectionsState.cache[col.id]!.requests)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    expect(reqs2.map((r) => r.id)).toEqual([r3.id, r1.id, r2.id])
    expect(reqs2[0].order).toBe(1)
    expect(reqs2[1].order).toBe(2)
    expect(reqs2[2].order).toBe(3)
  })

  it("creates folders and moves requests between folders", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Folder Ops")
    const r1 = await collectionsApi.createRequest(col.id, { name: "req" })
    const folder = await collectionsApi.createFolder(col.id, RootCollectionFolderId, "Group")

    await collectionsApi.renameFolder(col.id, folder.id, "Group Renamed")

    await collectionsApi.moveRequestToFolder(col.id, r1.id, folder.id)

    const updated = useApplication.getState().collectionsState.cache[col.id]!
    expect(updated.folders[folder.id]?.name).toBe("Group Renamed")
    expect(updated.folders[folder.id]?.requestIds).toContain(r1.id)
    expect(updated.folders[RootCollectionFolderId]?.requestIds).not.toContain(r1.id)
    expect(updated.requestIndex[r1.id]).toEqual({
      folderId: folder.id,
      ancestry: [RootCollectionFolderId, folder.id],
    })

    await collectionsApi.deleteFolder(col.id, folder.id)
    const afterDelete = useApplication.getState().collectionsState.cache[col.id]!
    expect(afterDelete.folders[folder.id]).toBeUndefined()
    expect(afterDelete.requests[r1.id]).toBeUndefined()
    expect(afterDelete.requestIndex[r1.id]).toBeUndefined()
  })

  it("records request ancestry for nested folders", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Request Index")
    const parent = await collectionsApi.createFolder(col.id, RootCollectionFolderId, "Parent")
    const child = await collectionsApi.createFolder(col.id, parent.id, "Child")

    const request = await collectionsApi.createRequest(col.id, {
      name: "Nested",
      folderId: child.id,
      method: "GET",
      url: "https://example.com",
    })

    const cache = useApplication.getState().collectionsState.cache[col.id]!
    const location = cache.requestIndex[request.id]
    expect(location?.folderId).toBe(child.id)
    expect(location?.ancestry).toEqual([RootCollectionFolderId, parent.id, child.id])
  })

  it("updates request ancestry when moving folders", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Folder Move Ancestry")
    const sourceParent = await collectionsApi.createFolder(col.id, RootCollectionFolderId, "Source")
    const destinationParent = await collectionsApi.createFolder(col.id, RootCollectionFolderId, "Destination")
    const child = await collectionsApi.createFolder(col.id, sourceParent.id, "Nested")

    const request = await collectionsApi.createRequest(col.id, {
      name: "Nested Request",
      folderId: child.id,
      method: "GET",
      url: "https://example.com",
    })

    const beforeMove = useApplication.getState().collectionsState.cache[col.id]!
    expect(beforeMove.requestIndex[request.id]).toEqual({
      folderId: child.id,
      ancestry: [RootCollectionFolderId, sourceParent.id, child.id],
    })

    await collectionsApi.moveFolder(col.id, child.id, destinationParent.id)

    const afterMove = useApplication.getState().collectionsState.cache[col.id]!
    expect(afterMove.requestIndex[request.id]).toEqual({
      folderId: child.id,
      ancestry: [RootCollectionFolderId, destinationParent.id, child.id],
    })
  })

  it("removes request index entries when deleting requests", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Delete Request Index")
    const request = await collectionsApi.createRequest(col.id, { name: "Transient" })

    const cache = useApplication.getState().collectionsState.cache[col.id]!
    expect(cache.requestIndex[request.id]).toBeDefined()

    await collectionsApi.deleteRequest(col.id, request.id)

    const afterDelete = useApplication.getState().collectionsState.cache[col.id]!
    expect(afterDelete.requestIndex[request.id]).toBeUndefined()
  })

  it("rebuilds request index when saving a scratch request", async () => {
    const { collectionsApi } = useApplication.getState()
    const target = await collectionsApi.addCollection("Scratch Target")
    const temp = await collectionsApi.createRequest(ScratchCollectionId, { name: "Temp" })

    const scratchBefore = useApplication.getState().collectionsState.cache[ScratchCollectionId]!
    expect(scratchBefore.requestIndex[temp.id]).toBeDefined()

    useApplication.setState((state) => {
      saveScratchRequest(state, {
        id: temp.id,
        collectionId: target.id,
        name: temp.name,
      })
    })

    const scratchAfter = useApplication.getState().collectionsState.cache[ScratchCollectionId]!
    expect(scratchAfter.requestIndex[temp.id]).toBeUndefined()

    const targetCollection = useApplication.getState().collectionsState.cache[target.id]!
    expect(targetCollection.requestIndex[temp.id]).toBeDefined()
    expect(targetCollection.requestIndex[temp.id]?.folderId).toBe(RootCollectionFolderId)
  })

  it("moves folders into new positions when a drop index is provided", async () => {
    const { collectionsApi } = useApplication.getState()
    const col = await collectionsApi.addCollection("Folder Ordering")
    const first = await collectionsApi.createFolder(col.id, RootCollectionFolderId, "First")
    const second = await collectionsApi.createFolder(col.id, RootCollectionFolderId, "Second")
    const third = await collectionsApi.createFolder(col.id, RootCollectionFolderId, "Third")

    await collectionsApi.moveFolder(col.id, third.id, RootCollectionFolderId, 1)

    const rootFolder = useApplication.getState().collectionsState.cache[col.id]!.folders[RootCollectionFolderId]!
    expect(rootFolder.childFolderIds).toEqual([first.id, third.id, second.id])
  })
})
