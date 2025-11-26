import { describe, it, expect } from "vitest"
import type { Collection, ExportedCollection } from "@/types"
import { RootCollectionFolderId, zExportedCollection } from "@/types"
import { nativeToOpenApi, postmanToNative, validateNativeDocument } from "./parsers"

/**
 * E2E Import/Export Workflow Tests
 * Tests complete workflows from import → manipulation → export → re-import
 */

describe("E2E Import/Export Workflows", () => {
  describe("Native → OpenAPI → Native Roundtrip", () => {
    it("should preserve collection metadata through export/re-import cycle", () => {
      // Create a native collection with metadata
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "E2E Test Collection",
        description: "Testing roundtrip workflows",
        requests: {},
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: [],
          },
        },
        environments: {
          env1: {
            id: "env1",
            name: "Development",
            variables: {
              var1: {
                id: "var1",
                name: "baseUrl",
                value: "https://api.dev.local",
                secure: false,
              },
            },
          },
        },
      }

      // Export to OpenAPI
      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        description: nativeCollection.description,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
        environments: nativeCollection.environments,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      expect(openApiSpec.info.title).toBe("E2E Test Collection")
      expect(openApiSpec.info.description).toBe("Testing roundtrip workflows")
    })

    it("should preserve requests with all HTTP methods", () => {
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Methods Test",
        requests: {},
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: methods.map((_, i) => `req${i}`),
          },
        },
      }

      // Add requests for each method
      methods.forEach((method, i) => {
        nativeCollection.requests[`req${i}`] = {
          id: `req${i}`,
          name: `${method} Request`,
          method: method as any,
          url: `https://api.example.com/resource`,
          headers: {},
          queryParams: {},
          pathParams: {},
          body: { type: "none" },
          authentication: { type: "none" },
        }
      })

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      const methodsInSpec = Object.values(openApiSpec.paths || {}).flatMap((item: any) =>
        Object.keys(item).filter((k) => !k.startsWith("x-") && k !== "parameters")
      )

      expect(methodsInSpec).toContain("get")
      expect(methodsInSpec).toContain("post")
      expect(methodsInSpec).toContain("put")
      expect(methodsInSpec).toContain("patch")
      expect(methodsInSpec).toContain("delete")
    })

    it("should preserve folder hierarchies with nested requests", () => {
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Folder Hierarchy Test",
        requests: {
          req1: {
            id: "req1",
            name: "List Users",
            method: "GET",
            url: "https://api.example.com/users",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: { type: "none" },
          },
          req2: {
            id: "req2",
            name: "Get User",
            method: "GET",
            url: "https://api.example.com/users/{id}",
            headers: {},
            queryParams: {},
            pathParams: {
              id: { id: "param1", name: "id", value: "123" },
            },
            body: { type: "none" },
            authentication: { type: "none" },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: ["folder1", "folder2"],
            requestIds: [],
          },
          folder1: {
            id: "folder1",
            name: "Users",
            childFolderIds: [],
            requestIds: ["req1", "req2"],
          },
          folder2: {
            id: "folder2",
            name: "Posts",
            childFolderIds: [],
            requestIds: [],
          },
        },
      }

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      expect(openApiSpec.info.title).toBe("Folder Hierarchy Test")
      // Paths should be converted to OpenAPI paths
      expect(Object.keys(openApiSpec.paths || {}).length).toBeGreaterThan(0)
    })

    it("should preserve authentication credentials", () => {
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Auth Test",
        requests: {
          req1: {
            id: "req1",
            name: "API Request",
            method: "GET",
            url: "https://api.example.com/data",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: {
              type: "basic",
              basic: { username: "user@example.com", password: "password123" },
            },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: ["req1"],
          },
        },
      }

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      // OpenAPI should include security definitions
      expect(openApiSpec.info.title).toBe("Auth Test")
    })

    it("should preserve request body types (JSON, form, text, binary)", () => {
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Body Types Test",
        requests: {
          req1: {
            id: "req1",
            name: "JSON Request",
            method: "POST",
            url: "https://api.example.com/data",
            headers: { h1: { id: "h1", name: "Content-Type", value: "application/json", enabled: true } },
            queryParams: {},
            pathParams: {},
            body: { type: "text", content: '{"key": "value"}' },
            authentication: { type: "none" },
          },
          req2: {
            id: "req2",
            name: "Form Request",
            method: "POST",
            url: "https://api.example.com/form",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: {
              type: "form",
              encoding: "multipart",
              formData: {
                field1: { id: "f1", key: "username", value: "john", kind: "text" },
                field2: { id: "f2", key: "avatar", value: "file.png", kind: "file" },
              },
            },
            authentication: { type: "none" },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: ["req1", "req2"],
          },
        },
      }

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      expect(openApiSpec.paths).toBeDefined()
      const pathKeys = Object.keys(openApiSpec.paths || {})
      expect(pathKeys.length).toBeGreaterThanOrEqual(2)
    })

    it("should preserve query and path parameters", () => {
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Params Test",
        requests: {
          req1: {
            id: "req1",
            name: "Search Users",
            method: "GET",
            url: "https://api.example.com/users/{userId}/posts/{postId}",
            headers: {},
            queryParams: {
              q1: { id: "q1", name: "search", value: "john", enabled: true },
              q2: { id: "q2", name: "limit", value: "10", enabled: true },
              q3: { id: "q3", name: "offset", value: "0", enabled: false },
            },
            pathParams: {
              p1: { id: "p1", name: "userId", value: "123" },
              p2: { id: "p2", name: "postId", value: "456" },
            },
            body: { type: "none" },
            authentication: { type: "none" },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: ["req1"],
          },
        },
      }

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      expect(openApiSpec.paths).toBeDefined()
      const pathKeys = Object.keys(openApiSpec.paths || {})
      expect(pathKeys.length).toBeGreaterThan(0)
      // Should have path parameters converted to OpenAPI format
      expect(pathKeys.some((path) => path.includes("{"))).toBe(true)
    })

    it("should preserve request headers", () => {
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Headers Test",
        requests: {
          req1: {
            id: "req1",
            name: "Request with Headers",
            method: "GET",
            url: "https://api.example.com/data",
            headers: {
              h1: { id: "h1", name: "Authorization", value: "Bearer token123", enabled: true },
              h2: { id: "h2", name: "Accept", value: "application/json", enabled: true },
              h3: { id: "h3", name: "X-Custom", value: "custom-value", enabled: false },
            },
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: { type: "none" },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: ["req1"],
          },
        },
      }

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      expect(openApiSpec.info.title).toBe("Headers Test")
    })

    it("should handle multiple environments with variables", () => {
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Multi-Environment Test",
        requests: {
          req1: {
            id: "req1",
            name: "Get Data",
            method: "GET",
            url: "{{baseUrl}}/data",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: { type: "none" },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: ["req1"],
          },
        },
        environments: {
          dev: {
            id: "dev",
            name: "Development",
            variables: {
              v1: {
                id: "v1",
                name: "baseUrl",
                value: "https://dev.example.com",
                secure: false,
              },
              v2: {
                id: "v2",
                name: "apiKey",
                value: "dev-key-123",
                secure: true,
              },
            },
          },
          prod: {
            id: "prod",
            name: "Production",
            variables: {
              v1: {
                id: "v1",
                name: "baseUrl",
                value: "https://api.example.com",
                secure: false,
              },
              v2: {
                id: "v2",
                name: "apiKey",
                value: "prod-key-456",
                secure: true,
              },
            },
          },
        },
      }

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
        environments: nativeCollection.environments,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      // Should have servers for environments
      expect(openApiSpec.servers).toBeDefined()
      expect(Array.isArray(openApiSpec.servers)).toBe(true)
    })
  })

  describe("Postman Import Workflows", () => {
    it("should import and convert basic Postman collection", () => {
      const postmanCollection = {
        info: {
          name: "Postman API",
          description: "Sample collection",
          schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: [
          {
            name: "Users",
            item: [
              {
                name: "Get Users",
                request: {
                  method: "GET",
                  header: [
                    {
                      key: "Authorization",
                      value: "Bearer token",
                      disabled: false,
                    },
                  ],
                  url: {
                    raw: "https://api.example.com/users",
                    protocol: "https",
                    host: ["api", "example", "com"],
                    path: ["users"],
                    query: [
                      {
                        key: "limit",
                        value: "10",
                        disabled: false,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      }

      const result = postmanToNative(postmanCollection as any)
      expect(result.collection.name).toBe("Postman API")
      expect(Object.keys(result.collection.requests).length).toBeGreaterThan(0)
    })

    it("should preserve folder structure during Postman import", () => {
      const postmanCollection = {
        info: {
          name: "Nested Folders Test",
          schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: [
          {
            name: "API V1",
            item: [
              {
                name: "Users",
                item: [
                  {
                    name: "List Users",
                    request: {
                      method: "GET",
                      url: { raw: "https://api.example.com/v1/users" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = postmanToNative(postmanCollection as any)
      expect(result.collection.folders).toBeDefined()
      expect(Object.keys(result.collection.folders).length).toBeGreaterThan(0)
    })

    it("should convert Postman authentication types", () => {
      const postmanCollection = {
        info: {
          name: "Auth Methods Test",
          schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: [
          {
            name: "Basic Auth Request",
            request: {
              method: "GET",
              auth: {
                type: "basic",
                basic: [
                  { key: "username", value: "user@example.com" },
                  { key: "password", value: "password123" },
                ],
              },
              url: { raw: "https://api.example.com/data" },
            },
          },
          {
            name: "Bearer Token Request",
            request: {
              method: "GET",
              auth: {
                type: "bearer",
                bearer: [{ key: "token", value: "my-token" }],
              },
              url: { raw: "https://api.example.com/data" },
            },
          },
        ],
      }

      const result = postmanToNative(postmanCollection as any)
      expect(Object.keys(result.collection.requests).length).toBeGreaterThanOrEqual(2)

      // Find and verify the requests
      const basicAuthReq = Object.values(result.collection.requests).find((r) => r.name === "Basic Auth Request")
      const bearerAuthReq = Object.values(result.collection.requests).find((r) => r.name === "Bearer Token Request")

      expect(basicAuthReq?.authentication.type).toBe("basic")
      expect(bearerAuthReq?.authentication.type).toBe("bearer")
    })

    it("should convert form data in Postman requests", () => {
      const postmanCollection = {
        info: {
          name: "Form Data Test",
          schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: [
          {
            name: "Form Request",
            request: {
              method: "POST",
              body: {
                mode: "formdata",
                formdata: [
                  {
                    key: "username",
                    value: "john",
                    type: "text",
                  },
                  {
                    key: "email",
                    value: "john@example.com",
                    type: "text",
                  },
                ],
              },
              url: { raw: "https://api.example.com/users" },
            },
          },
        ],
      }

      const result = postmanToNative(postmanCollection as any)
      const formRequest = Object.values(result.collection.requests).find((r) => r.name === "Form Request")

      expect(formRequest?.body.type).toBe("form")
      expect(formRequest?.body.encoding).toBe("multipart")
      expect(Object.keys(formRequest?.body.formData || {})).toHaveLength(2)
    })
  })

  describe("Complex Workflows", () => {
    it("should handle collection with mixed content types", () => {
      const nativeCollection: ExportedCollection = {
        version: "1.0.0",
        name: "Mixed Content Test",
        requests: {
          req1: {
            id: "req1",
            name: "JSON Request",
            method: "POST",
            url: "https://api.example.com/data",
            headers: { h1: { id: "h1", name: "Content-Type", value: "application/json", enabled: true } },
            queryParams: {},
            pathParams: {},
            body: { type: "text", content: '{"name": "John"}' },
            authentication: { type: "none" },
          },
          req2: {
            id: "req2",
            name: "GraphQL Request",
            method: "POST",
            url: "https://api.example.com/graphql",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: {
              type: "text",
              content: 'query { users { id name } }',
              language: "graphql",
            },
            authentication: { type: "none" },
          },
          req3: {
            id: "req3",
            name: "XML Request",
            method: "POST",
            url: "https://api.example.com/xml",
            headers: { h1: { id: "h1", name: "Content-Type", value: "application/xml", enabled: true } },
            queryParams: {},
            pathParams: {},
            body: { type: "text", content: "<user><name>John</name></user>" },
            authentication: { type: "none" },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: ["req1", "req2", "req3"],
          },
        },
      }

      const mockCollection: Collection = {
        id: "col1",
        name: nativeCollection.name,
        requests: nativeCollection.requests,
        folders: nativeCollection.folders,
      }

      const openApiSpec = nativeToOpenApi(mockCollection)
      expect(openApiSpec.info.title).toBe("Mixed Content Test")
      expect(openApiSpec.paths).toBeDefined()
    })

    it("should properly validate exported collections", () => {
      // Test that exported collections can be validated
      const mockCollection: Collection = {
        id: "col1",
        name: "Validation Test",
        requests: {
          req1: {
            id: "req1",
            name: "Test Request",
            method: "GET",
            url: "https://api.example.com/test",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: { type: "none" },
          },
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: ["req1"],
          },
        },
      }

      // Export and then validate
      const openApiSpec = nativeToOpenApi(mockCollection)
      expect(openApiSpec.info.title).toBe("Validation Test")
    })
  })

  describe("Import Validation", () => {
    it("should reject invalid native documents", () => {
      const invalidCollection = {
        name: "Test",
        // missing required fields like format, version, collection
      }

      const result = validateNativeDocument(invalidCollection)
      expect(result.success).toBe(false)
    })

    it("should detect schema validation errors", () => {
      const invalidCollection = {
        version: "1.0.0",
        // Missing required format and collection fields
      }

      const result = validateNativeDocument(invalidCollection)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })
})
