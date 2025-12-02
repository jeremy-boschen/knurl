// Consolidated test suite for src/state/collections.ts
import {beforeEach, describe, expect, it, vi} from "vitest"
import {useApplication} from "@/state/application"
import type {CollectionCache, ExportedCollection, RequestState} from "@/types"
import {RootCollectionFolderId} from "@/types"
import {sanitizeCollection, saveScratchRequest} from "@/state/collections"
// ------- from collections.import.test.ts -------
import {createStore} from "zustand"
import {immer} from "zustand/middleware/immer"
import {subscribeWithSelector} from "zustand/middleware"
import {enablePatches} from "immer"
import {withStorageManager} from "@/types/middleware/storage-manager"
import type {Application} from "@/types/application"
import {createCollectionsSlice, ScratchCollectionId} from "./collections"
import * as bindings from "@/bindings/knurl"

// ------- from collections.crud.test.ts -------
describe("collections CRUD", () => {
  it("addCollection creates a new index entry", async () => {
    const {collectionsApi} = useApplication.getState()
    const before = useApplication.getState().collectionsState.index.length
    const col = collectionsApi.addCollection("My Col", "Desc")
    const after = useApplication.getState().collectionsState.index.length
    expect(after).toBe(before + 1)
    expect(col.name).toBe("My Col")
  })

  it("updateCollection updates index name", async () => {
    const {collectionsApi} = useApplication.getState()
    const [entry] = useApplication.getState().collectionsState.index
    collectionsApi.updateCollection(entry.id, {name: "Renamed"})
    const updated = useApplication.getState().collectionsState.index.find((e) => e.id === entry.id)!
    expect(updated.name).toBe("Renamed")
  })

  it("removeCollection updates index", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Temp", "")
    const len = useApplication.getState().collectionsState.index.length
    collectionsApi.removeCollection(col.id)
    const len2 = useApplication.getState().collectionsState.index.length
    expect(len2).toBe(len - 1)
  })
})

// ------- from collections.patch.test.ts -------
describe("collections patch helpers", () => {
  it("updateRequestPatchHeader adds a header to patch", async () => {
    const {collectionsApi} = useApplication.getState()
    const [meta] = useApplication.getState().collectionsState.index
    let colId = meta?.id
    if (!colId) {
      const col = collectionsApi.addCollection("T")
      colId = col.id
    }
    collectionsApi.getCollection(colId!)
    const req = collectionsApi.createRequest(colId!, {name: "Patch", url: ""})
    collectionsApi.updateRequestPatchHeader(colId!, req.id, "h1", {name: "X-Test", value: "1", enabled: true})
    const updated = collectionsApi.getRequest(colId!, req.id)
    expect(updated.patch?.headers?.h1).toBeTruthy()
    expect(updated.patch?.headers?.h1?.name).toBe("X-Test")
  })

  it("updateRequestPatchQueryParam adds/removes param", async () => {
    const {collectionsApi} = useApplication.getState()
    let [meta] = useApplication.getState().collectionsState.index
    if (!meta) {
      const col = collectionsApi.addCollection("T2")
      meta = {id: col.id} as any
    }
    collectionsApi.getCollection(meta.id)
    const req = collectionsApi.createRequest(meta.id, {name: "QP", url: ""})
    collectionsApi.updateRequestPatchQueryParam(meta.id, req.id, "q1", {name: "a", value: "1", enabled: true})
    let updated = collectionsApi.getRequest(meta.id, req.id)
    expect(updated.patch?.queryParams?.q1).toBeTruthy()
    collectionsApi.updateRequestPatchQueryParam(meta.id, req.id, "q1", null)
    updated = collectionsApi.getRequest(meta.id, req.id)
    expect(updated.patch?.queryParams?.q1).toBeUndefined()
  })

  it("preserves untouched headers when patching a single header", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Patch Preserve")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.updateRequest(col.id, req.id, {
      headers: {
        h1: {id: "h1", name: "A", value: "1", enabled: true, secure: false},
        h2: {id: "h2", name: "B", value: "2", enabled: true, secure: false},
      },
    })

    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", {value: "99"})
    const updated = collectionsApi.getRequest(col.id, req.id)
    expect(updated.patch?.headers?.h1?.value).toBe("99")
    expect(updated.patch?.headers?.h2?.value).toBe("2")
  })

  it("preserves sibling path params when editing one", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Path Preserve")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.updateRequest(col.id, req.id, {
      pathParams: {
        p1: {id: "p1", name: "Foo", value: "1", enabled: true, secure: false},
        p2: {id: "p2", name: "Bar", value: "2", enabled: true, secure: false},
      },
    })

    collectionsApi.updateRequestPatchPathParam(col.id, req.id, "p1", {value: "99"})
    const patched = collectionsApi.getRequest(col.id, req.id)
    expect(patched.patch?.pathParams?.p1?.value).toBe("99")
    expect(patched.patch?.pathParams?.p2?.value).toBe("2")

    collectionsApi.commitRequestPatch(col.id, req.id)
    const committed = collectionsApi.getRequest(col.id, req.id)
    expect(committed.pathParams?.p1?.value).toBe("99")
    expect(committed.pathParams?.p2?.value).toBe("2")
  })
})

describe("collections patch and merge logic", () => {
  it("primitive patch fields are added/removed based on equality to base", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("P")
    const req = collectionsApi.createRequest(col.id, {name: "R", url: ""})
    // No-op change should not persist in patch
    collectionsApi.setRequestName(col.id, req.id, "R")
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.name).toBeUndefined()
    expect(r.name).toBe("R")
    // Actual change updates the name directly, NOT in patch (names are not undoable)
    collectionsApi.setRequestName(col.id, req.id, "R2")
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.name).toBe("R2")
    expect(r.patch?.name).toBeUndefined()
    // Changing back updates name directly, NOT in patch
    collectionsApi.setRequestName(col.id, req.id, "R")
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.name).toBe("R")
    expect(r.patch?.name).toBeUndefined()
  })

  it("setRequestName tracks changes and cleans when equal", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Name")
    const req = collectionsApi.createRequest(col.id, {name: "First", url: ""})
    collectionsApi.setRequestName(col.id, req.id, "Second")
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.name).toBe("Second")
    expect(r.patch?.name).toBeUndefined()
    collectionsApi.setRequestName(col.id, req.id, "First")
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.name).toBe("First")
    expect(r.patch?.name).toBeUndefined()
  })

  it("setRequestMethod toggles patch and cleans", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Method")
    const req = collectionsApi.createRequest(col.id, {name: "R", method: "GET", url: ""} as any)
    collectionsApi.setRequestMethod(col.id, req.id, "POST")
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.method).toBe("POST")
    collectionsApi.setRequestMethod(col.id, req.id, "GET")
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.method).toBeUndefined()
  })

  it("setRequestUrl toggles patch and cleans", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("URL")
    const req = collectionsApi.createRequest(col.id, {name: "R", url: "https://a"})
    collectionsApi.setRequestUrl(col.id, req.id, "https://b")
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.url).toBe("https://b")
    collectionsApi.setRequestUrl(col.id, req.id, "https://a")
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.url).toBeUndefined()
  })

  it("headers/add-update-delete and equality cleanup work as expected", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("H")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", {name: "A", value: "1", enabled: true})
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers?.h1?.value).toBe("1")
    // Update value; remains in patch
    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", {value: "2"})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers?.h1?.value).toBe("2")
    // Commit patch then remove; equality cleanup should clear headers from patch
    collectionsApi.commitRequestPatch(col.id, req.id)
    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", {value: "2"}) // equal to base now
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers).toBeUndefined()
  })

  it("body formData via generic update: remove differs from base (kept), adding back equal via generic update cleans patch", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("B")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    // Add formData via patch body
    collectionsApi.updateRequestBody(col.id, req.id, {
      formData: {f1: {id: "f1", key: "k", value: "v", enabled: true, secure: false, kind: "text"}},
    })
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.formData?.f1?.value).toBe("v")
    // Commit to base
    collectionsApi.commitRequestPatch(col.id, req.id)
    // Remove f1 via patch => differs from base so patch is kept
    collectionsApi.updateRequestBody(col.id, req.id, {
      formData: {f1: undefined} as any,
    })
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.formData).toEqual({})
    // Add it back equal to base using generic update (no equality cleanup here)
    const baseNow = collectionsApi.getRequest(col.id, req.id)
    collectionsApi.updateRequestBody(col.id, req.id, {
      formData: structuredClone(baseNow.body.formData ?? {}),
    } as any)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("body formData via dedicated API: adding back equal cleans patch", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("B2")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.updateRequestBody(col.id, req.id, {
      formData: {f1: {id: "f1", key: "k", value: "v", enabled: true, secure: false}} as any,
    })
    collectionsApi.commitRequestPatch(col.id, req.id)
    // Remove then add back using the specialized helper (which performs equality cleanup)
    collectionsApi.setRequestBodyFormField(col.id, req.id, "f1", null)
    const baseNow = collectionsApi.getRequest(col.id, req.id)
    collectionsApi.setRequestBodyFormField(col.id, req.id, "f1", baseNow.body.formData?.f1 as any)
    const r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("generic body equality cleanup on content/type/language/encoding", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("BODY")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    // Seed base body
    collectionsApi.updateRequestBody(col.id, req.id, {
      type: "text" as any,
      content: "A",
      language: "json" as any,
      encoding: "url" as any,
    })
    collectionsApi.commitRequestPatch(col.id, req.id)

    // No-op (equal) should clear patch
    collectionsApi.updateRequestBody(col.id, req.id, {content: "A"})
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Change and then change back clears patch
    collectionsApi.updateRequestBody(col.id, req.id, {content: "B"})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.content).toBe("B")
    collectionsApi.updateRequestBody(col.id, req.id, {content: "A"})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Type flip-back cleanup: change then change back
    collectionsApi.updateRequestBody(col.id, req.id, {type: "binary" as any})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.type).toBe("binary")
    collectionsApi.updateRequestBody(col.id, req.id, {type: "text" as any})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Language flip-back cleanup
    collectionsApi.updateRequestBody(col.id, req.id, {language: "yaml" as any})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.language).toBe("yaml")
    collectionsApi.updateRequestBody(col.id, req.id, {language: "json" as any})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})

    // Encoding flip-back cleanup
    collectionsApi.updateRequestBody(col.id, req.id, {encoding: "multipart" as any})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.body?.encoding).toBe("multipart")
    collectionsApi.updateRequestBody(col.id, req.id, {encoding: "url" as any})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("options shallow merge in patch and commit update the base, then clear patch", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("O")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.updateRequestOptions(col.id, req.id, {timeoutSecs: 10, userAgent: "UA"})
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.options?.timeoutSecs).toBe(10)
    expect(r.patch?.options?.userAgent).toBe("UA")
    collectionsApi.commitRequestPatch(col.id, req.id)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.options?.timeoutSecs).toBe(10)
    expect(r.options?.userAgent).toBe("UA")
    // Matching update removes patch
    collectionsApi.updateRequestOptions(col.id, req.id, {timeoutSecs: 10})
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("setRequestAutoSave toggles patch and resets when matching base", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("AUTO")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.setRequestAutoSave(col.id, req.id, true)
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.autoSave).toBe(true)
    collectionsApi.commitRequestPatch(col.id, req.id)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.autoSave).toBe(true)
    collectionsApi.setRequestAutoSave(col.id, req.id, true)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
    collectionsApi.setRequestAutoSave(col.id, req.id, false)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.autoSave).toBe(false)
  })

  it("generic headers: flip back to equality cleans patch", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("HDR")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    // Add header via generic update and commit to base
    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", {
      name: "A",
      value: "1",
      enabled: true,
    })
    collectionsApi.commitRequestPatch(col.id, req.id)
    // No-op equal update should clear patch
    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", {
      name: "A",
      value: "1",
      enabled: true,
    })
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
    // Remove differs -> keep patch, then add back equal -> clear
    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", null)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.headers).toBeDefined()
    collectionsApi.updateRequestPatchHeader(col.id, req.id, "h1", {
      name: "A",
      value: "1",
      enabled: true,
    })
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("generic query params: flip back to equality cleans patch", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("QRY")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.updateRequestPatchQueryParam(col.id, req.id, "q1", {
      name: "a",
      value: "1",
      enabled: true,
    })
    collectionsApi.commitRequestPatch(col.id, req.id)
    collectionsApi.updateRequestPatchQueryParam(col.id, req.id, "q1", {
      name: "a",
      value: "1",
      enabled: true,
    })
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
    collectionsApi.updateRequestPatchQueryParam(col.id, req.id, "q1", null)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.queryParams).toBeDefined()
    collectionsApi.updateRequestPatchQueryParam(col.id, req.id, "q1", {
      name: "a",
      value: "1",
      enabled: true,
    })
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("generic path params: flip back to equality cleans patch", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("PATH")
    const req = collectionsApi.createRequest(col.id, {name: "R"})
    collectionsApi.updateRequestPatchPathParam(col.id, req.id, "p1", {
      name: "id",
      value: "42",
      enabled: true,
      secure: false,
    })
    collectionsApi.commitRequestPatch(col.id, req.id)
    collectionsApi.updateRequestPatchPathParam(col.id, req.id, "p1", {
      name: "id",
      value: "42",
      enabled: true,
      secure: false,
    })
    let r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
    collectionsApi.updateRequestPatchPathParam(col.id, req.id, "p1", null)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch?.pathParams).toBeDefined()
    collectionsApi.updateRequestPatchPathParam(col.id, req.id, "p1", {
      name: "id",
      value: "42",
      enabled: true,
      secure: false,
    })
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.patch).toEqual({})
  })

  it("updateRequest moving folders updates membership and request index", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("UpdateMove")
    const source = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Source")
    const destination = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Destination")
    const request = collectionsApi.createRequest(col.id, {
      name: "Movable",
      folderId: source.id,
      method: "GET",
      url: "https://example.com",
    })

    const cacheBefore = useApplication.getState().collectionsState.cache[col.id]!
    expect(cacheBefore.requestIndex[request.id]).toEqual({
      folderId: source.id,
      ancestry: [RootCollectionFolderId, source.id],
    })

    collectionsApi.updateRequest(col.id, request.id, {folderId: destination.id})

    const cache = useApplication.getState().collectionsState.cache[col.id]!
    expect(cache.folders[source.id]?.requestIds).not.toContain(request.id)
    expect(cache.folders[destination.id]?.requestIds).toContain(request.id)
    expect(cache.requestIndex[request.id]).toEqual({
      folderId: destination.id,
      ancestry: [RootCollectionFolderId, destination.id],
    })
  })

  it("auth type change in patch removes old type data after commit", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("A")
    const req = collectionsApi.createRequest(col.id, {
      name: "R",
      authentication: {type: "bearer", bearer: {token: "T"}} as any
    })
    collectionsApi.setRequestAuthentication(col.id, req.id, {type: "basic", basic: {username: "u"}} as any)
    let r = collectionsApi.getRequest(col.id, req.id)
    // Merge view: type reflects patch
    expect((r.patch?.authentication as any).type).toBe("basic")
    collectionsApi.commitRequestPatch(col.id, req.id)
    r = collectionsApi.getRequest(col.id, req.id)
    expect(r.authentication.type).toBe("basic")
    expect((r.authentication as any).basic.username).toBe("u")
    expect((r.authentication as any).bearer).toBeUndefined()
  })
})

// ------- from collections.sanitize.test.ts -------
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({label: "main"}),
}))

const baseCollection = (): CollectionCache => ({
  id: "col-1",
  name: "Test",
  updated: new Date().toISOString(),
  encryption: {algorithm: "aes-gcm", key: undefined},
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
  authentication: {type: "none"},
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
  body: {type: "none"},
  authentication: {type: "none"},
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
      bearer: {token: "COL_TOKEN", scheme: "Bearer", placement: {type: "header", name: "Authorization"}},
    } as any
    col.requests = {
      "req-1": req({
        authentication: {
          type: "bearer",
          bearer: {token: "REQ_TOKEN", scheme: "Bearer", placement: {type: "header", name: "Authorization"}},
        } as any,
        patch: {
          authentication: {
            type: "bearer",
            bearer: {token: "PATCH_TOKEN", scheme: "Bearer", placement: {type: "header", name: "Authorization"}},
          } as any,
        },
      }),
    }
    col.folders[RootCollectionFolderId].requestIds = ["req-1"]
    col.requestIndex["req-1"] = {folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId]}
    const sanitized = sanitizeCollection(col)
    expect((sanitized.authentication as any).bearer.token).toBeUndefined()
    const r = sanitized.requests["req-1"]!
    expect((r.authentication as any).bearer.token).toBeUndefined()
    expect((r.patch!.authentication as any).bearer.token).toBeUndefined()
  })

  it("leaves non-bearer auth intact (e.g., basic, oauth2)", () => {
    const col = baseCollection()
    col.authentication = {type: "basic", basic: {username: "u", password: "p"}} as any
    col.requests = {
      "req-1": req({
        authentication: {type: "oauth2", oauth2: {clientId: "cid", clientSecret: "cs"} as any},
        patch: {authentication: {type: "basic", basic: {username: "u2", password: "p2"}} as any},
      }),
    }
    col.folders[RootCollectionFolderId].requestIds = ["req-1"]
    col.requestIndex["req-1"] = {folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId]}
    const sanitized = sanitizeCollection(col)
    expect((sanitized.authentication as any).basic.password).toBe("p")
    const r = sanitized.requests["req-1"]!
    expect((r.authentication as any).oauth2.clientSecret).toBe("cs")
    expect((r.patch!.authentication as any).basic.password).toBe("p2")
  })
})

const createTestStore = () =>
  createStore<Application>()(
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
    ;(store as any).broadcastPatch = () => {
    }
  })

  it("defaults missing authentication to none on import", async () => {
    const {collectionsApi} = store.getState()

    const imported = collectionsApi.importCollection(
      {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: {
          id: "legacy-without-auth",
          name: "Legacy",
          updated: new Date().toISOString(),
          encryption: {algorithm: "aes-gcm"},
          environments: {},
          requests: {},
        },
      },
      "Imported",
    )

    const loaded = collectionsApi.getCollection(imported.id)
    expect(loaded.authentication.type).toBe("none")
    expect(loaded.id).not.toBe(ScratchCollectionId)
  })

  it("coerces collection-level inherit auth to none on import", async () => {
    const {collectionsApi} = store.getState()
    const imported = collectionsApi.importCollection(
      {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: {
          id: "legacy-col",
          name: "Legacy",
          updated: new Date().toISOString(),
          encryption: {algorithm: "aes-gcm"},
          environments: {},
          requests: {},
          authentication: {type: "inherit" as any},
        },
      },
      "Imported",
    )
    const loaded = collectionsApi.getCollection(imported.id)
    expect(loaded.authentication.type).toBe("none")
    expect(loaded.id).not.toBe(ScratchCollectionId)
  })

  it("round-trips nested folders and requests through export/import", async () => {
    const {collectionsApi} = store.getState()

    const original = collectionsApi.addCollection("Original")
    const parentFolder = collectionsApi.createFolder(original.id, RootCollectionFolderId, "Group")
    const childFolder = collectionsApi.createFolder(original.id, parentFolder.id, "Nested")

    collectionsApi.createRequest(original.id, {
      name: "Root Request",
      method: "GET",
      url: "https://example.com/root",
    })

    collectionsApi.createRequest(original.id, {
      name: "Nested Request",
      method: "POST",
      url: "https://example.com/nested",
      folderId: childFolder.id,
    })

    const exported = collectionsApi.exportCollection(original.id)
    const imported = collectionsApi.importCollection(exported, "Imported Copy")
    const loaded = collectionsApi.getCollection(imported.id)

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
    ;(store as any).broadcastPatch = () => {
    }

    const colId = "col-load-1"
    const reqId = "req-load-1"

    // Make the collection discoverable by getCollection via index
    store.setState((s) => {
      s.collectionsState.index = [
        {id: colId, name: "Loaded", count: 1, updated: new Date().toISOString()} as any,
      ]
    })

    // Mock loadAppData to return a collection with an empty patch {}
    const spy = vi.spyOn(bindings, "loadAppData").mockImplementation(async (fileName: string) => {
      if (fileName === `collections/${colId}.json`) {
        return {
          header: {version: 1, updated: new Date().toISOString()},
          content: {
            id: colId,
            name: "Loaded",
            updated: new Date().toISOString(),
            encryption: {algorithm: "aes-gcm"},
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
                body: {type: "none"},
                authentication: {type: "none"},
                options: {},
                patch: {},
                updated: 0,
              },
            },
            authentication: {type: "none"},
          },
        } as any
      }
      // Index or other files: let default mocked IPC handle or return null
      return null as any
    })

    const {collectionsApi} = store.getState()
    await collectionsApi.loadCollection(colId)
    const loaded = collectionsApi.getCollection(colId)
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
    onCloseRequested: vi.fn(async () => () => {
    }),
  }),
}))
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({label: "main"}),
}))

// ------- from collections.order.test.ts -------
describe("collections and requests ordering", () => {
  it("assigns increasing order to new collections and supports reordering", async () => {
    const {collectionsApi} = useApplication.getState()
    const a = collectionsApi.addCollection("A")
    const b = collectionsApi.addCollection("B")
    const c = collectionsApi.addCollection("C")
    const index = useApplication.getState().collectionsState.index.filter((e) => e.id !== "scratch")
    const ea = index.find((e) => e.id === a.id)!
    const eb = index.find((e) => e.id === b.id)!
    const ec = index.find((e) => e.id === c.id)!
    expect(ea.order).toBeLessThan(eb.order!)
    expect(eb.order).toBeLessThan(ec.order!)
    collectionsApi.reorderCollections([b.id, a.id, c.id])
    const ix2 = useApplication.getState().collectionsState.index.filter((e) => e.id !== "scratch")
    const ids2 = ix2.map((e) => e.id)
    expect(ids2.slice(0, 3)).toEqual([b.id, a.id, c.id])
    // Orders start from 0 for collections (scratch collection is excluded above)
    expect(ix2[0].order).toBe(0)
    expect(ix2[1].order).toBe(1)
    expect(ix2[2].order).toBe(2)
  })

  it("assigns increasing order to new requests and supports reordering", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Order Test")
    const r1 = collectionsApi.createRequest(col.id, {name: "r1"})
    const r2 = collectionsApi.createRequest(col.id, {name: "r2"})
    const r3 = collectionsApi.createRequest(col.id, {name: "r3"})
    const reqs = Object.values(useApplication.getState().collectionsState.cache[col.id]!.requests)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    expect(reqs.map((r) => r.id)).toEqual([r1.id, r2.id, r3.id])
    collectionsApi.reorderRequestsInFolder(col.id, RootCollectionFolderId, [r3.id, r1.id, r2.id])
    const reqs2 = Object.values(useApplication.getState().collectionsState.cache[col.id]!.requests)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    expect(reqs2.map((r) => r.id)).toEqual([r3.id, r1.id, r2.id])
    expect(reqs2[0].order).toBe(1)
    expect(reqs2[1].order).toBe(2)
    expect(reqs2[2].order).toBe(3)
  })

  it("creates folders and moves requests between folders", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Folder Ops")
    const r1 = collectionsApi.createRequest(col.id, {name: "req"})
    const folder = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Group")

    collectionsApi.renameFolder(col.id, folder.id, "Group Renamed")

    collectionsApi.moveRequestToFolder(col.id, r1.id, folder.id)

    const updated = useApplication.getState().collectionsState.cache[col.id]!
    expect(updated.folders[folder.id]?.name).toBe("Group Renamed")
    expect(updated.folders[folder.id]?.requestIds).toContain(r1.id)
    expect(updated.folders[RootCollectionFolderId]?.requestIds).not.toContain(r1.id)
    expect(updated.requestIndex[r1.id]).toEqual({
      folderId: folder.id,
      ancestry: [RootCollectionFolderId, folder.id],
    })

    collectionsApi.deleteFolder(col.id, folder.id)
    const afterDelete = useApplication.getState().collectionsState.cache[col.id]!
    expect(afterDelete.folders[folder.id]).toBeUndefined()
    expect(afterDelete.requests[r1.id]).toBeUndefined()
    expect(afterDelete.requestIndex[r1.id]).toBeUndefined()
  })

  it("records request ancestry for nested folders", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Request Index")
    const parent = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Parent")
    const child = collectionsApi.createFolder(col.id, parent.id, "Child")

    const request = collectionsApi.createRequest(col.id, {
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
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Folder Move Ancestry")
    const sourceParent = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Source")
    const destinationParent = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Destination")
    const child = collectionsApi.createFolder(col.id, sourceParent.id, "Nested")

    const request = collectionsApi.createRequest(col.id, {
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

    collectionsApi.moveFolder(col.id, child.id, destinationParent.id)

    const afterMove = useApplication.getState().collectionsState.cache[col.id]!
    expect(afterMove.requestIndex[request.id]).toEqual({
      folderId: child.id,
      ancestry: [RootCollectionFolderId, destinationParent.id, child.id],
    })
  })

  it("removes request index entries when deleting requests", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Delete Request Index")
    const request = collectionsApi.createRequest(col.id, {name: "Transient"})

    const cache = useApplication.getState().collectionsState.cache[col.id]!
    expect(cache.requestIndex[request.id]).toBeDefined()

    collectionsApi.deleteRequest(col.id, request.id)

    const afterDelete = useApplication.getState().collectionsState.cache[col.id]!
    expect(afterDelete.requestIndex[request.id]).toBeUndefined()
  })

  it("rebuilds request index when saving a scratch request", async () => {
    const {collectionsApi} = useApplication.getState()
    const target = collectionsApi.addCollection("Scratch Target")
    await collectionsApi.loadCollection(ScratchCollectionId)
    const temp = collectionsApi.createRequest(ScratchCollectionId, {name: "Temp"})

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
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Folder Ordering")
    const first = collectionsApi.createFolder(col.id, RootCollectionFolderId, "First")
    const second = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Second")
    const third = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Third")

    collectionsApi.moveFolder(col.id, third.id, RootCollectionFolderId, 1)

    const rootFolder = useApplication.getState().collectionsState.cache[col.id]!.folders[RootCollectionFolderId]!
    expect(rootFolder.childFolderIds).toEqual([first.id, third.id, second.id])
  })

  it("reorders folders under a parent and refreshes sibling order metadata", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Folder Reorder Metadata")
    const first = collectionsApi.createFolder(col.id, RootCollectionFolderId, "First")
    const second = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Second")
    const third = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Third")

    collectionsApi.reorderFolders(col.id, RootCollectionFolderId, [third.id, first.id])

    const cache = useApplication.getState().collectionsState.cache[col.id]!
    const rootFolder = cache.folders[RootCollectionFolderId]!
    expect(rootFolder.childFolderIds).toEqual([third.id, first.id, second.id])
    expect(cache.folders[third.id]?.order).toBe(1)
    expect(cache.folders[first.id]?.order).toBe(2)
    expect(cache.folders[second.id]?.order).toBe(3)
    expect(cache.folders[third.id]?.parentId).toBe(RootCollectionFolderId)
    expect(cache.folders[first.id]?.parentId).toBe(RootCollectionFolderId)
    expect(cache.folders[second.id]?.parentId).toBe(RootCollectionFolderId)
  })

  it("moveRequestToFolder inserts at target position and updates order/index", async () => {
    const {collectionsApi} = useApplication.getState()
    const col = collectionsApi.addCollection("Move Request Position")
    const folder = collectionsApi.createFolder(col.id, RootCollectionFolderId, "Target")
    const first = collectionsApi.createRequest(col.id, {name: "First", folderId: folder.id})
    const second = collectionsApi.createRequest(col.id, {name: "Second", folderId: folder.id})
    const mover = collectionsApi.createRequest(col.id, {name: "Mover"})

    collectionsApi.moveRequestToFolder(col.id, mover.id, folder.id, 1)

    const cache = useApplication.getState().collectionsState.cache[col.id]!
    expect(cache.folders[folder.id]?.requestIds).toEqual([first.id, mover.id, second.id])
    expect(cache.requests[mover.id]?.order).toBe(2)
    expect(cache.requests[first.id]?.order).toBe(1)
    expect(cache.requests[second.id]?.order).toBe(3)
    expect(cache.requestIndex[mover.id]).toEqual({
      folderId: folder.id,
      ancestry: [RootCollectionFolderId, folder.id],
    })
  })

  it("mergeCollection upserts requests and environments from export", async () => {
    const {collectionsApi} = useApplication.getState()
    const base = collectionsApi.addCollection("Merge Base")
    const existing = collectionsApi.createRequest(base.id, {
      name: "Existing",
      method: "GET",
      url: "https://api.example.com/items",
    })

    useApplication.setState((state) => {
      const collection = state.collectionsState.cache[base.id]!
      collection.environments = {
        env_existing: {
          id: "env_existing",
          name: "Existing Env",
          description: "",
          variables: {},
        },
      }
    })

    const exported: ExportedCollection = {
      format: "native",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      collection: {
        environments: {
          env_existing: {id: "env_existing", name: "Existing Env Updated", variables: {}},
          env_new: {id: "env_new", name: "New Env", variables: {}},
        },
        requests: {
          [existing.id]: {
            id: existing.id,
            name: "Existing Updated",
            method: "GET",
            url: "https://api.example.com/items",
            body: {type: "none"},
            authentication: {type: "none"},
            options: {},
          },
          "new-request": {
            id: "new-request",
            name: "New Request",
            method: "POST",
            url: "https://api.example.com/create",
            body: {type: "none"},
            authentication: {type: "none"},
            options: {},
            folderId: RootCollectionFolderId,
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "Root",
            parentId: null,
            childFolderIds: [],
            requestIds: [existing.id, "new-request"],
          },
        },
      },
    }

    const summary = collectionsApi.mergeCollection(base.id, exported)
    expect(summary.addedRequests).toBe(1)
    expect(summary.updatedRequests).toBe(1)
    expect(summary.addedEnvironments).toBe(1)
    expect(summary.updatedEnvironments).toBe(1)

    const cache = useApplication.getState().collectionsState.cache[base.id]!
    expect(cache.requests["new-request"]).toBeTruthy()
    expect(cache.requests[existing.id]?.name).toBe("Existing Updated")
    expect(cache.environments?.env_existing?.name).toBe("Existing Env Updated")
    expect(cache.environments?.env_new?.name).toBe("New Env")
    expect(cache.requestIndex[existing.id]).toEqual({
      folderId: RootCollectionFolderId,
      ancestry: [RootCollectionFolderId],
    })
    expect(cache.requestIndex["new-request"]).toEqual({
      folderId: RootCollectionFolderId,
      ancestry: [RootCollectionFolderId],
    })
  })

  it("mergeCollection creates missing folders before inserting requests", async () => {
    const {collectionsApi} = useApplication.getState()
    const base = collectionsApi.addCollection("Merge Folders")

    const exported: ExportedCollection = {
      format: "native",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      collection: {
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "Root",
            parentId: null,
            childFolderIds: ["child-folder"],
            requestIds: [],
          },
          "child-folder": {
            id: "child-folder",
            name: "Imported Child",
            parentId: RootCollectionFolderId,
            childFolderIds: [],
            requestIds: ["child-request"],
          },
        },
        requests: {
          "child-request": {
            id: "child-request",
            name: "Child Request",
            method: "GET",
            url: "https://api.example.com/child",
            body: {type: "none"},
            authentication: {type: "none"},
            options: {},
            folderId: "child-folder",
          },
        },
      },
    }

    const summary = collectionsApi.mergeCollection(base.id, exported)
    expect(summary.addedRequests).toBe(1)
    const cache = useApplication.getState().collectionsState.cache[base.id]!
    expect(cache.folders["child-folder"]).toBeTruthy()
    expect(cache.folders["child-folder"]?.requestIds).toContain("child-request")
    expect(cache.requestIndex["child-request"]).toEqual({
      folderId: "child-folder",
      ancestry: [RootCollectionFolderId, "child-folder"],
    })
  })
})

// ------- Environment operations -------
describe("environment management", () => {
  it("createEnvironment adds a new environment to a collection", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest")
    collectionsApi.getCollection(col.id)

    const env = collectionsApi.createEnvironment(col.id, "Dev", "Development environment")
    expect(env.name).toBe("Dev")
    expect(env.description).toBe("Development environment")

    const updated = useApplication.getState().collectionsState.cache[col.id]!
    expect(updated.environments?.[env.id]).toBeTruthy()
    expect(updated.environments?.[env.id]?.name).toBe("Dev")
  })

  it("createEnvironment creates environment without description", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest2")
    collectionsApi.getCollection(col.id)

    const env = collectionsApi.createEnvironment(col.id, "Prod")
    expect(env.name).toBe("Prod")
    // Description defaults to empty string when not provided
    expect(env.description).toBe("")
  })

  it("updateEnvironment modifies environment properties", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest3")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "Stage", "Staging")

    collectionsApi.updateEnvironment(col.id, env.id, { name: "Staging Renamed", description: "Updated description" })

    const updated = useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!
    expect(updated.name).toBe("Staging Renamed")
    expect(updated.description).toBe("Updated description")
  })

  it("deleteEnvironment removes an environment from the collection", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest4")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "Temp")

    const before = Object.keys(useApplication.getState().collectionsState.cache[col.id]!.environments || {}).length
    collectionsApi.deleteEnvironment(col.id, env.id)
    const after = Object.keys(useApplication.getState().collectionsState.cache[col.id]!.environments || {}).length

    expect(after).toBe(before - 1)
  })

  it("setActiveEnvironment marks an environment as active", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest5")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "Active")

    collectionsApi.setActiveEnvironment(col.id, env.id)
    const updated = useApplication.getState().collectionsState.cache[col.id]!
    expect(updated.activeEnvironmentId).toBe(env.id)
  })

  it("setActiveEnvironment can clear the active environment with undefined", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest6")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "Temp")

    collectionsApi.setActiveEnvironment(col.id, env.id)
    collectionsApi.setActiveEnvironment(col.id, undefined)

    const updated = useApplication.getState().collectionsState.cache[col.id]!
    expect(updated.activeEnvironmentId).toBeUndefined()
  })

  it("addEnvironmentVariable adds a variable to an environment", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest7")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "Vars")

    const variable = collectionsApi.addEnvironmentVariable(col.id, env.id, {
      name: "API_KEY",
      value: "secret123",
      secure: true,
    })

    expect(variable.name).toBe("API_KEY")
    expect(variable.value).toBe("secret123")
    expect(variable.secure).toBe(true)

    const updated = useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!
    expect(updated.variables[variable.id]).toBeTruthy()
  })

  it("addEnvironmentVariable creates variable with defaults", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest8")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "DefaultVars")

    const variable = collectionsApi.addEnvironmentVariable(col.id, env.id, { name: "PLAIN" })

    expect(variable.name).toBe("PLAIN")
    expect(variable.value).toBe("")
    expect(variable.secure).toBe(false)
  })

  it("updateEnvironmentVariable modifies a variable", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest9")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "VarUpdate")
    const variable = collectionsApi.addEnvironmentVariable(col.id, env.id, { name: "DB_PASS", value: "old" })

    collectionsApi.updateEnvironmentVariable(col.id, env.id, variable.id, { value: "new123", secure: true })

    const updated = useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!.variables[variable.id]!
    expect(updated.value).toBe("new123")
    expect(updated.secure).toBe(true)
    expect(updated.name).toBe("DB_PASS") // Name unchanged
  })

  it("deleteEnvironmentVariable removes a variable from an environment", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest10")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "VarDelete")
    const variable = collectionsApi.addEnvironmentVariable(col.id, env.id, { name: "TEMP_VAR" })

    const before = Object.keys(useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!.variables || {}).length
    collectionsApi.deleteEnvironmentVariable(col.id, env.id, variable.id)
    const after = Object.keys(useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!.variables || {}).length

    expect(after).toBe(before - 1)
  })

  it("environment operations with multiple variables", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest11")
    collectionsApi.getCollection(col.id)
    const env = collectionsApi.createEnvironment(col.id, "Multi")

    const var1 = collectionsApi.addEnvironmentVariable(col.id, env.id, { name: "VAR1", value: "val1" })
    const var2 = collectionsApi.addEnvironmentVariable(col.id, env.id, { name: "VAR2", value: "val2" })
    const var3 = collectionsApi.addEnvironmentVariable(col.id, env.id, { name: "VAR3", value: "val3" })

    let cached = useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!
    expect(Object.keys(cached.variables).length).toBe(3)

    collectionsApi.updateEnvironmentVariable(col.id, env.id, var2.id, { value: "updated" })
    cached = useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!
    expect(cached.variables[var2.id].value).toBe("updated")

    collectionsApi.deleteEnvironmentVariable(col.id, env.id, var1.id)
    cached = useApplication.getState().collectionsState.cache[col.id]!.environments?.[env.id]!
    expect(Object.keys(cached.variables).length).toBe(2)
    expect(cached.variables[var1.id]).toBeUndefined()
  })

  it("multiple environments in a collection are independent", () => {
    const { collectionsApi } = useApplication.getState()
    const col = collectionsApi.addCollection("EnvTest12")
    collectionsApi.getCollection(col.id)

    const envDev = collectionsApi.createEnvironment(col.id, "Dev")
    const envProd = collectionsApi.createEnvironment(col.id, "Prod")

    collectionsApi.addEnvironmentVariable(col.id, envDev.id, { name: "ENDPOINT", value: "http://localhost" })
    collectionsApi.addEnvironmentVariable(col.id, envProd.id, { name: "ENDPOINT", value: "https://api.prod.com" })

    const cached = useApplication.getState().collectionsState.cache[col.id]!
    const devVar = Object.values(cached.environments?.[envDev.id]!.variables || {})[0]
    const prodVar = Object.values(cached.environments?.[envProd.id]!.variables || {})[0]

    expect(devVar.value).toBe("http://localhost")
    expect(prodVar.value).toBe("https://api.prod.com")
  })
})
