import { describe, expect, it } from "vitest"
import { RootCollectionFolderId } from "@/types"
import { useApplication } from "@/state/application"
import { nativeToOpenApi } from "./parsers"

/**
 * OpenAPI export tests: verify Knurl collections convert correctly to OpenAPI 3.1.0
 */

describe("OpenAPI export (nativeToOpenApi)", () => {
  describe("basic conversion", () => {
    it("exports collection metadata to OpenAPI info", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("My API")
      collectionsApi.updateCollection(original.id, {
        description: "My API collection",
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      expect(openapi.openapi).toBe("3.1.0")
      expect(openapi.info.title).toBe("My API")
      expect(openapi.info.description).toBe("My API collection")
      expect(openapi.info.version).toBe("1.0.0")
    })

    it("exports empty collection with no servers or paths", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Empty Collection")

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      expect(openapi.paths).toEqual({})
      expect(openapi.servers).toBeUndefined()
    })
  })

  describe("server and environment conversion", () => {
    it("exports environments with baseUrl to OpenAPI servers", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("With Servers")

      useApplication.setState((state) => {
        const collection = state.collectionsState.cache[original.id]!
        collection.environments = {
          dev: {
            id: "dev",
            name: "Development",
            description: "Dev server",
            variables: {
              v1: { id: "v1", name: "baseUrl", value: "http://localhost:3000", secure: false },
              v2: { id: "v2", name: "apiKey", value: "dev-key", secure: true },
            },
          },
          prod: {
            id: "prod",
            name: "Production",
            description: "Prod server",
            variables: {
              v3: { id: "v3", name: "baseUrl", value: "https://api.example.com", secure: false },
            },
          },
        }
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      expect(openapi.servers).toHaveLength(2)

      const devServer = openapi.servers?.find((s) => s.url === "http://localhost:3000")
      expect(devServer).toBeDefined()
      expect(devServer?.description).toBe("Dev server")
      expect(devServer?.variables?.apiKey.default).toBe("dev-key")

      const prodServer = openapi.servers?.find((s) => s.url === "https://api.example.com")
      expect(prodServer).toBeDefined()
      expect(prodServer?.description).toBe("Prod server")
    })

    it("omits environments without baseUrl variable", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Incomplete Env")

      useApplication.setState((state) => {
        const collection = state.collectionsState.cache[original.id]!
        collection.environments = {
          incomplete: {
            id: "incomplete",
            name: "Incomplete",
            description: "",
            variables: {
              v1: { id: "v1", name: "apiKey", value: "key", secure: false },
            },
          },
        }
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      expect(openapi.servers).toBeUndefined()
    })
  })

  describe("path and operation conversion", () => {
    it("exports simple GET request to OpenAPI path", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("GET API")
      collectionsApi.createRequest(original.id, {
        name: "List Users",
        method: "GET",
        url: "{{baseUrl}}/users",
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      expect(openapi.paths["/users"]).toBeDefined()
      expect(openapi.paths["/users"]?.get).toBeDefined()
      expect(openapi.paths["/users"]?.get?.summary).toBe("List Users")
    })

    it("exports POST request with body to OpenAPI", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("POST API")
      const request = collectionsApi.createRequest(original.id, {
        name: "Create User",
        method: "POST",
        url: "{{baseUrl}}/users",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "text",
          language: "json",
          content: '{"name":"John","email":"john@example.com"}',
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const postOp = openapi.paths["/users"]?.post
      expect(postOp).toBeDefined()
      expect(postOp?.requestBody?.required).toBe(true)
      expect(postOp?.requestBody?.content["application/json"]).toBeDefined()
    })

    it("exports path parameters to OpenAPI", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Path Params API")
      const request = collectionsApi.createRequest(original.id, {
        name: "Get User",
        method: "GET",
        url: "{{baseUrl}}/users/{id}",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        pathParams: {
          p1: { id: "p1", name: "id", value: "123", enabled: true, secure: false },
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const getOp = openapi.paths["/users/{id}"]?.get
      expect(getOp?.parameters).toBeDefined()
      const idParam = getOp?.parameters?.find((p) => p.name === "id")
      expect(idParam?.in).toBe("path")
      expect(idParam?.required).toBe(true)
    })

    it("exports query parameters to OpenAPI", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Query Params API")
      const request = collectionsApi.createRequest(original.id, {
        name: "List Users",
        method: "GET",
        url: "{{baseUrl}}/users",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        queryParams: {
          q1: { id: "q1", name: "page", value: "1", enabled: true, secure: false },
          q2: { id: "q2", name: "limit", value: "50", enabled: true, secure: false },
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const getOp = openapi.paths["/users"]?.get
      expect(getOp?.parameters).toHaveLength(2)
      const pageParam = getOp?.parameters?.find((p) => p.name === "page")
      expect(pageParam?.in).toBe("query")
    })

    it("exports all HTTP methods", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("All Methods")

      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
      for (const method of methods) {
        collectionsApi.createRequest(original.id, {
          name: `${method} User`,
          method,
          url: "{{baseUrl}}/users",
        })
      }

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const pathItem = openapi.paths["/users"]
      expect(pathItem?.get).toBeDefined()
      expect(pathItem?.post).toBeDefined()
      expect(pathItem?.put).toBeDefined()
      expect(pathItem?.patch).toBeDefined()
      expect(pathItem?.delete).toBeDefined()
      expect(pathItem?.head).toBeDefined()
      expect(pathItem?.options).toBeDefined()
    })

    it("exports multiple paths", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Multi-path API")

      collectionsApi.createRequest(original.id, {
        name: "List Users",
        method: "GET",
        url: "{{baseUrl}}/users",
      })

      collectionsApi.createRequest(original.id, {
        name: "List Posts",
        method: "GET",
        url: "{{baseUrl}}/posts",
      })

      collectionsApi.createRequest(original.id, {
        name: "Get User",
        method: "GET",
        url: "{{baseUrl}}/users/{id}",
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      expect(Object.keys(openapi.paths)).toContain("/users")
      expect(Object.keys(openapi.paths)).toContain("/posts")
      expect(Object.keys(openapi.paths)).toContain("/users/{id}")
    })
  })

  describe("tags and folder mapping", () => {
    it("exports folder names as tags", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Tagged API")

      const usersFolder = collectionsApi.createFolder(original.id, RootCollectionFolderId, "Users")
      const postsFolder = collectionsApi.createFolder(original.id, RootCollectionFolderId, "Posts")

      collectionsApi.createRequest(original.id, {
        name: "List Users",
        method: "GET",
        url: "{{baseUrl}}/users",
        folderId: usersFolder.id,
      })

      collectionsApi.createRequest(original.id, {
        name: "List Posts",
        method: "GET",
        url: "{{baseUrl}}/posts",
        folderId: postsFolder.id,
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const usersOp = openapi.paths["/users"]?.get
      expect(usersOp?.tags).toContain("Users")

      const postsOp = openapi.paths["/posts"]?.get
      expect(postsOp?.tags).toContain("Posts")
    })

    it("omits tags for root-level requests", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Untagged API")

      collectionsApi.createRequest(original.id, {
        name: "Health",
        method: "GET",
        url: "{{baseUrl}}/health",
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const healthOp = openapi.paths["/health"]?.get
      expect(healthOp?.tags).toBeUndefined()
    })
  })

  describe("body type conversion", () => {
    it("exports JSON body with application/json content type", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("JSON API")
      const request = collectionsApi.createRequest(original.id, {
        name: "Create",
        method: "POST",
        url: "{{baseUrl}}/items",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "text",
          language: "json",
          content: '{"name":"test"}',
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const postOp = openapi.paths["/items"]?.post
      expect(postOp?.requestBody?.content["application/json"]).toBeDefined()
    })

    it("exports XML body with application/xml content type", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("XML API")
      const request = collectionsApi.createRequest(original.id, {
        name: "Create",
        method: "POST",
        url: "{{baseUrl}}/items",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "text",
          language: "xml",
          content: "<item><name>test</name></item>",
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const postOp = openapi.paths["/items"]?.post
      expect(postOp?.requestBody?.content["application/xml"]).toBeDefined()
    })

    it("exports GraphQL body with application/graphql content type", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("GraphQL API")
      const request = collectionsApi.createRequest(original.id, {
        name: "Query",
        method: "POST",
        url: "{{baseUrl}}/graphql",
      })

      const query = "query { users { id name } }"
      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "text",
          language: "graphql",
          content: query,
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const postOp = openapi.paths["/graphql"]?.post
      expect(postOp?.requestBody?.content["application/graphql"]).toBeDefined()
    })
  })

  describe("round-trip consistency", () => {
    it("round-trips a collection through OpenAPI export and re-import", () => {
      const { collectionsApi } = useApplication.getState()

      // Create a reasonably complete collection
      const original = collectionsApi.addCollection("Complete API")
      const usersFolder = collectionsApi.createFolder(original.id, RootCollectionFolderId, "Users")

      useApplication.setState((state) => {
        const collection = state.collectionsState.cache[original.id]!
        collection.environments = {
          env1: {
            id: "env1",
            name: "Production",
            description: "",
            variables: {
              baseUrl: { id: "bv", name: "baseUrl", value: "https://api.example.com", secure: false },
              apiKey: { id: "av", name: "apiKey", value: "secret", secure: true },
            },
          },
        }
      })

      const listReq = collectionsApi.createRequest(original.id, {
        name: "List Users",
        method: "GET",
        url: "{{baseUrl}}/users",
        folderId: usersFolder.id,
      })

      collectionsApi.updateRequest(original.id, listReq.id, {
        queryParams: {
          q1: { id: "q1", name: "page", value: "1", enabled: true, secure: false },
        },
      })

      // Export to OpenAPI
      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      // Verify OpenAPI structure
      expect(openapi.info.title).toBe("Complete API")
      expect(openapi.servers).toHaveLength(1)
      expect(openapi.servers?.[0].url).toBe("https://api.example.com")
      expect(openapi.paths["/users"]?.get?.tags).toContain("Users")
      expect(openapi.paths["/users"]?.get?.parameters).toHaveLength(1)
    })
  })

  describe("edge cases", () => {
    it("handles requests without baseUrl prefix", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("No Prefix API")

      collectionsApi.createRequest(original.id, {
        name: "Get",
        method: "GET",
        url: "/users",
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      expect(openapi.paths["/users"]).toBeDefined()
    })

    it("handles requests with multiple path variables", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Multi-Var API")
      const request = collectionsApi.createRequest(original.id, {
        name: "Get Comment",
        method: "GET",
        url: "{{baseUrl}}/users/{userId}/posts/{postId}/comments/{commentId}",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        pathParams: {
          p1: { id: "p1", name: "userId", value: "1", enabled: true, secure: false },
          p2: { id: "p2", name: "postId", value: "2", enabled: true, secure: false },
          p3: { id: "p3", name: "commentId", value: "3", enabled: true, secure: false },
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      const path = "/users/{userId}/posts/{postId}/comments/{commentId}"
      const getOp = openapi.paths[path]?.get
      expect(getOp?.parameters).toHaveLength(3)
    })

    it("skips requests with invalid methods", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Invalid Method API")

      const request = collectionsApi.createRequest(original.id, {
        name: "Test",
        method: "GET",
        url: "{{baseUrl}}/test",
      })

      // Manually set an invalid method (bypassing normal validation)
      useApplication.setState((state) => {
        const collection = state.collectionsState.cache[original.id]!
        const req = collection.requests[request.id]
        if (req) {
          req.method = "INVALID" as any
        }
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      // Should skip the invalid method request
      expect(openapi.paths["/test"]).toBeUndefined()
    })

    it("handles malformed JSON bodies gracefully", () => {
      const { collectionsApi } = useApplication.getState()
      const original = collectionsApi.addCollection("Malformed API")
      const request = collectionsApi.createRequest(original.id, {
        name: "Create",
        method: "POST",
        url: "{{baseUrl}}/items",
      })

      collectionsApi.updateRequest(original.id, request.id, {
        body: {
          type: "text",
          language: "json",
          content: "{invalid json}",
        },
      })

      const collection = collectionsApi.getCollection(original.id)
      const openapi = nativeToOpenApi(collection)

      // Should fall back to string example when JSON parse fails
      const postOp = openapi.paths["/items"]?.post
      expect(postOp?.requestBody?.content["application/json"]?.example).toBe("{invalid json}")
    })
  })
})
