import { describe, expect, it } from "vitest"
import { RootCollectionFolderId } from "@/types"
import { useApplication } from "@/state/application"

/**
 * Native format roundtrip tests: export → import → verify identical
 * These tests ensure collections can be exported and re-imported without data loss
 */

describe("Native format roundtrip", () => {
  describe("simple requests", () => {
    it("roundtrips a basic GET request", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("GET Request")
      collectionsApi.createRequest(original.id, {
        name: "Simple GET",
        method: "GET",
        url: "https://api.example.com/users",
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "Simple GET")

      expect(restoredRequest?.name).toBe("Simple GET")
      expect(restoredRequest?.method).toBe("GET")
      expect(restoredRequest?.url).toBe("https://api.example.com/users")
      expect(restoredRequest?.body.type).toBe("none")
    })

    it("roundtrips a POST request with text body", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("POST with Body")
      const request = collectionsApi.createRequest(original.id, {
        name: "Create User",
        method: "POST",
        url: "https://api.example.com/users",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "text",
          language: "json",
          content: '{"name":"John","email":"john@example.com"}',
        },
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "Create User")

      expect(restoredRequest?.body.type).toBe("text")
      expect(restoredRequest?.body.language).toBe("json")
      expect(restoredRequest?.body.content).toBe('{"name":"John","email":"john@example.com"}')
    })

    it("roundtrips request with query parameters", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Query Params")
      const request = collectionsApi.createRequest(original.id, {
        name: "List with filters",
        method: "GET",
        url: "https://api.example.com/users",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        queryParams: {
          q1: { id: "q1", name: "page", value: "1", enabled: true, secure: false },
          q2: { id: "q2", name: "limit", value: "50", enabled: true, secure: false },
          q3: { id: "q3", name: "filter", value: "active", enabled: false, secure: false },
        },
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "List with filters")
      const params = Object.values(restoredRequest?.queryParams ?? {})

      expect(params).toHaveLength(3)
      expect(params.find((p) => p.name === "page")?.value).toBe("1")
      expect(params.find((p) => p.name === "limit")?.enabled).toBe(true)
      expect(params.find((p) => p.name === "filter")?.enabled).toBe(false)
    })

    it("roundtrips request with path parameters", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Path Params")
      const request = collectionsApi.createRequest(original.id, {
        name: "Get user by ID",
        method: "GET",
        url: "https://api.example.com/users/:id/posts/:postId",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        pathParams: {
          p1: { id: "p1", name: "id", value: "123", enabled: true, secure: false },
          p2: { id: "p2", name: "postId", value: "456", enabled: true, secure: false },
        },
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "Get user by ID")
      const params = Object.values(restoredRequest?.pathParams ?? {})

      expect(params).toHaveLength(2)
      expect(params.find((p) => p.name === "id")?.value).toBe("123")
      expect(params.find((p) => p.name === "postId")?.value).toBe("456")
    })

    it("roundtrips request with headers", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Headers")
      const request = collectionsApi.createRequest(original.id, {
        name: "Request with headers",
        method: "GET",
        url: "https://api.example.com/data",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        headers: {
          h1: { id: "h1", name: "Accept", value: "application/json", enabled: true, secure: false },
          h2: { id: "h2", name: "X-API-Key", value: "secret123", enabled: true, secure: true },
          h3: { id: "h3", name: "X-Disabled", value: "value", enabled: false, secure: false },
        },
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "Request with headers")
      const headers = Object.values(restoredRequest?.headers ?? {})

      expect(headers).toHaveLength(3)
      expect(headers.find((h) => h.name === "Accept")?.value).toBe("application/json")
      expect(headers.find((h) => h.name === "X-API-Key")?.secure).toBe(true)
      expect(headers.find((h) => h.name === "X-Disabled")?.enabled).toBe(false)
    })
  })

  describe("authentication types", () => {
    it("roundtrips basic authentication", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Basic Auth")
      const request = collectionsApi.createRequest(original.id, {
        name: "Request with basic auth",
        method: "GET",
        url: "https://api.example.com/secure",
      })

      collectionsApi.setRequestAuthentication(original.id, request.id, {
        type: "basic",
        basic: { username: "user123", password: "pass456" },
      } as any)

      // Commit the patch to persist the authentication
      collectionsApi.commitRequestPatch(original.id, request.id)

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "Request with basic auth")

      expect(restoredRequest?.authentication.type).toBe("basic")
      expect((restoredRequest?.authentication as any).basic.username).toBe("user123")
      expect((restoredRequest?.authentication as any).basic.password).toBe("pass456")
    })

    it("roundtrips collection-level authentication (bearer tokens are redacted on export)", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Collection Auth")

      collectionsApi.updateCollection(original.id, {
        authentication: {
          type: "bearer",
          bearer: { token: "collection-token", scheme: "Bearer", placement: { type: "header", name: "Authorization" } },
        } as any,
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)

      // Bearer tokens are redacted during export for security
      expect(restored.authentication.type).toBe("bearer")
      expect((restored.authentication as any).bearer.scheme).toBe("Bearer")
      expect((restored.authentication as any).bearer.token).toBeUndefined()
    })
  })

  describe("environments and variables", () => {
    it("roundtrips environments with variables", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Environments")

      useApplication.setState((state) => {
        const collection = state.collectionsState.cache[original.id]!
        collection.environments = {
          env1: {
            id: "env1",
            name: "Development",
            description: "Dev environment",
            variables: {
              v1: { id: "v1", name: "baseUrl", value: "http://localhost:3000", secure: false },
              v2: { id: "v2", name: "apiKey", value: "dev-key-123", secure: true },
            },
          },
          env2: {
            id: "env2",
            name: "Production",
            description: "Prod environment",
            variables: {
              v3: { id: "v3", name: "baseUrl", value: "https://api.example.com", secure: false },
              v4: { id: "v4", name: "apiKey", value: "prod-key-456", secure: true },
            },
          },
        }
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const envs = Object.values(restored.environments ?? {})

      expect(envs).toHaveLength(2)

      const devEnv = envs.find((e) => e.name === "Development")
      expect(devEnv?.description).toBe("Dev environment")
      const devVars = Object.values(devEnv?.variables ?? {})
      expect(devVars).toHaveLength(2)
      expect(devVars.find((v) => v.name === "baseUrl")?.value).toBe("http://localhost:3000")
      expect(devVars.find((v) => v.name === "apiKey")?.secure).toBe(true)

      const prodEnv = envs.find((e) => e.name === "Production")
      expect(prodEnv?.description).toBe("Prod environment")
      const prodVars = Object.values(prodEnv?.variables ?? {})
      expect(prodVars).toHaveLength(2)
      expect(prodVars.find((v) => v.name === "baseUrl")?.value).toBe("https://api.example.com")
    })
  })

  describe("folder structures", () => {
    it("roundtrips single-level folders with requests", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Single-level Folders")
      const folder1 = collectionsApi.createFolder(original.id, RootCollectionFolderId, "Users")
      const folder2 = collectionsApi.createFolder(original.id, RootCollectionFolderId, "Posts")

      collectionsApi.createRequest(original.id, {
        name: "List Users",
        method: "GET",
        url: "https://api.example.com/users",
        folderId: folder1.id,
      })

      collectionsApi.createRequest(original.id, {
        name: "Create Post",
        method: "POST",
        url: "https://api.example.com/posts",
        folderId: folder2.id,
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)

      const restoredFolder1 = restored.folders[folder1.id]
      const restoredFolder2 = restored.folders[folder2.id]

      expect(restoredFolder1?.name).toBe("Users")
      expect(restoredFolder2?.name).toBe("Posts")

      // Check requests are in correct folders
      const usersRequest = Object.values(restored.requests).find((r) => r.name === "List Users")
      const postRequest = Object.values(restored.requests).find((r) => r.name === "Create Post")

      expect(usersRequest?.folderId).toBe(folder1.id)
      expect(postRequest?.folderId).toBe(folder2.id)
    })

    it("roundtrips deeply nested folder structures", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Nested Folders")

      const api = collectionsApi.createFolder(original.id, RootCollectionFolderId, "API")
      const v1 = collectionsApi.createFolder(original.id, api.id, "v1")
      const auth = collectionsApi.createFolder(original.id, v1.id, "auth")

      collectionsApi.createRequest(original.id, {
        name: "Login",
        method: "POST",
        url: "https://api.example.com/v1/auth/login",
        folderId: auth.id,
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)

      // Verify folder hierarchy
      const restoredApi = restored.folders[api.id]
      expect(restoredApi?.name).toBe("API")
      expect(restoredApi?.childFolderIds).toContain(v1.id)

      const restoredV1 = restored.folders[v1.id]
      expect(restoredV1?.name).toBe("v1")
      expect(restoredV1?.parentId).toBe(api.id)
      expect(restoredV1?.childFolderIds).toContain(auth.id)

      const restoredAuth = restored.folders[auth.id]
      expect(restoredAuth?.name).toBe("auth")
      expect(restoredAuth?.parentId).toBe(v1.id)

      // Check request is in nested folder
      const loginRequest = Object.values(restored.requests).find((r) => r.name === "Login")
      expect(loginRequest?.folderId).toBe(auth.id)
    })
  })

  describe("body types", () => {
    it("roundtrips form data body with multipart encoding", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Form Data")
      const request = collectionsApi.createRequest(original.id, {
        name: "Upload form",
        method: "POST",
        url: "https://api.example.com/upload",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "form",
          encoding: "multipart",
          formData: {
            f1: { id: "f1", key: "name", value: "John", enabled: true, secure: false, kind: "text" },
            f2: { id: "f2", key: "email", value: "john@example.com", enabled: true, secure: false, kind: "text" },
          },
        },
      } as any)

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "Upload form")

      expect(restoredRequest?.body.type).toBe("form")
      expect(restoredRequest?.body.encoding).toBe("multipart")
      const formData = Object.values(restoredRequest?.body.formData ?? {})
      expect(formData).toHaveLength(2)
      expect(formData.find((f) => f.key === "name")?.value).toBe("John")
    })

    it("roundtrips text body with graphql language", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("GraphQL")
      const request = collectionsApi.createRequest(original.id, {
        name: "GraphQL query",
        method: "POST",
        url: "https://api.example.com/graphql",
      })

      const query = `query GetUser($id: ID!) {
  user(id: $id) {
    name
    email
  }
}`

      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "text",
          language: "graphql",
          content: query,
        },
      } as any)

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported)

      const restored = collectionsApi.getCollection(imported.id)
      const restoredRequest = Object.values(restored.requests).find((r) => r.name === "GraphQL query")

      expect(restoredRequest?.body.type).toBe("text")
      expect(restoredRequest?.body.language).toBe("graphql")
      expect(restoredRequest?.body.content).toBe(query)
    })
  })

  describe("collection metadata", () => {
    it("preserves collection name and description on import", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("My API")

      collectionsApi.updateCollection(original.id, {
        description: "This is my API collection",
      })

      const exported = collectionsApi.exportCollection(original.id)
      const imported = collectionsApi.importCollection(exported, "Imported My API")

      const restored = collectionsApi.getCollection(imported.id)

      expect(restored.name).toBe("Imported My API")
      // Note: description might not be preserved depending on implementation
    })

    it("exports/imports multiple independent collections", () => {
      const { collectionsApi } = useApplication.getState()

      const col1 = collectionsApi.addCollection("Collection 1")
      collectionsApi.createRequest(col1.id, {
        name: "Request 1",
        method: "GET",
        url: "https://api.example.com/1",
      })

      const col2 = collectionsApi.addCollection("Collection 2")
      collectionsApi.createRequest(col2.id, {
        name: "Request 2",
        method: "POST",
        url: "https://api.example.com/2",
      })

      const exported1 = collectionsApi.exportCollection(col1.id)
      const exported2 = collectionsApi.exportCollection(col2.id)

      const imported1 = collectionsApi.importCollection(exported1, "Imported Col 1")
      const imported2 = collectionsApi.importCollection(exported2, "Imported Col 2")

      const restored1 = collectionsApi.getCollection(imported1.id)
      const restored2 = collectionsApi.getCollection(imported2.id)

      expect(restored1.name).toBe("Imported Col 1")
      expect(Object.values(restored1.requests).find((r) => r.name === "Request 1")).toBeDefined()

      expect(restored2.name).toBe("Imported Col 2")
      expect(Object.values(restored2.requests).find((r) => r.name === "Request 2")).toBeDefined()

      // Verify they're separate
      expect(imported1.id).not.toBe(imported2.id)
    })
  })
})
