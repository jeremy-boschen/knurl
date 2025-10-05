import { describe, it, expect } from "vitest"
import { RootCollectionFolderId, zCollectionState } from "@/types/collections"

// Repro for safeParse TypeError using provided payload
describe("migration parse", () => {
  it("parses provided collection after migration defaults", () => {
    const payload = {
      activeEnvironmentId: "c7OraSioLNAI",
      authentication: { type: "none" },
      description: "",
      encryption: { algorithm: "aes-gcm" },
      environments: {
        c7OraSioLNAI: {
          description: "Local developer environment",
          id: "c7OraSioLNAI",
          name: "Local Machine",
          variables: {
            f5abaRcL: { id: "f5abaRcL", name: "", secure: false, value: "" },
          },
        },
      },
      id: "BARqthSCrFbh",
      name: "Collection #2",
      requests: {
        Ce1jHA8pqEUX: {
          authentication: {
            bearer: { placement: { type: "cookie" }, scheme: "Bearer", token: "x" },
            type: "bearer",
          },
          autoSave: true,
          body: { type: "none" },
          collectionId: "BARqthSCrFbh",
          headers: {},
          id: "Ce1jHA8pqEUX",
          method: "GET",
          name: "Auth - Bearer",
          options: { disableSsl: false },
          patch: {
            authentication: {
              bearer: { placement: { type: "query" }, scheme: "Bearer", token: "x" },
              type: "bearer",
            },
          },
          pathParams: {},
          queryParams: {},
          updated: 65,
          url: "http://localhost:3000/userinfo",
        },
      },
      updated: new Date().toISOString(),
    }

    // Simulate migration defaults akin to our migrate() to avoid undefineds
    for (const r of Object.values(payload.requests)) {
      // @ts-expect-error - runtime patching for test
      r.authentication ||= { type: "none" }
      // Ensure bearer placement has names so schema union is satisfied
      // @ts-expect-error - runtime patching for test
      const b = r.authentication.bearer
      if (b?.placement?.type === "header") {
        b.placement.name ||= "Authorization"
      } else if (b?.placement && (b.placement.type === "query" || b.placement.type === "cookie")) {
        b.placement.name ||= ""
      }
      // Normalize patch.auth too
      // @ts-expect-error - runtime patching for test
      const pa = r.patch?.authentication
      if (pa?.bearer?.placement?.type === "header") {
        pa.bearer.placement.name ||= "Authorization"
      } else if (pa?.bearer?.placement && (pa.bearer.placement.type === "query" || pa.bearer.placement.type === "cookie")) {
        pa.bearer.placement.name ||= ""
      }
    }

    const res = zCollectionState.safeParse(payload)
    expect(res.success).toBe(true)
  })
})

describe("collection folders schema", () => {
  it("accepts collections with nested folder trees and request folder references", () => {
    const now = new Date().toISOString()
    const parsed = zCollectionState.parse({
      id: "col-1",
      name: "Nested",
      description: "",
      updated: now,
      encryption: { algorithm: "aes-gcm" },
      environments: {},
      authentication: { type: "none" },
      requests: {
        "req-1": {
          id: "req-1",
          name: "Fetch",
          collectionId: "col-1",
          method: "GET",
          url: "https://example.com",
          folderId: "folder-child",
          pathParams: {},
          queryParams: {},
          headers: {},
          cookieParams: {},
          body: { type: "none" },
          authentication: { type: "none" },
        },
      },
      folders: {
        [RootCollectionFolderId]: {
          id: RootCollectionFolderId,
          name: "Root",
          parentId: null,
          order: 0,
          childFolderIds: ["folder-child"],
          requestIds: [],
        },
        "folder-child": {
          id: "folder-child",
          name: "Child",
          parentId: RootCollectionFolderId,
          order: 1,
          childFolderIds: [],
          requestIds: ["req-1"],
        },
      },
    })

    expect(parsed.folders[RootCollectionFolderId]?.childFolderIds).toContain("folder-child")
    expect(parsed.folders["folder-child"]?.requestIds).toContain("req-1")
    expect(parsed.requests["req-1"]?.folderId).toBe("folder-child")
  })

  it("defaults folders to an empty map when omitted", () => {
    const parsed = zCollectionState.parse({
      id: "col-2",
      name: "No Folders",
      updated: new Date().toISOString(),
      encryption: { algorithm: "aes-gcm" },
      environments: {},
      authentication: { type: "none" },
      requests: {},
    })

    expect(parsed.folders).toEqual({})
  })
})
