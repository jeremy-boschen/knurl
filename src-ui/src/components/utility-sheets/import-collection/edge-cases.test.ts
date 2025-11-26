import { describe, it, expect } from "vitest"
import type { Collection, ExportedCollection } from "@/types"
import { RootCollectionFolderId } from "@/types"
import { nativeToOpenApi, postmanToNative, validateNativeDocument } from "./parsers"

/**
 * Edge Cases and Error Handling Tests
 * Tests boundary conditions, error scenarios, and unusual inputs
 */

describe("Edge Cases and Error Handling", () => {
  describe("Empty and Minimal Collections", () => {
    it("should handle completely empty collection", () => {
      const emptyCollection: Collection = {
        id: "col1",
        name: "Empty Collection",
        requests: {},
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: [],
          },
        },
      }

      const openApiSpec = nativeToOpenApi(emptyCollection)
      expect(openApiSpec.info.title).toBe("Empty Collection")
      expect(openApiSpec.paths).toBeDefined()
      // Empty collection should have empty or minimal paths
      expect(typeof openApiSpec.paths).toBe("object")
    })

    it("should handle collection with only metadata", () => {
      const minimalCollection: Collection = {
        id: "col1",
        name: "Minimal Collection",
        description: "Just a name and description",
        requests: {},
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds: [],
          },
        },
      }

      const openApiSpec = nativeToOpenApi(minimalCollection)
      expect(openApiSpec.info.title).toBe("Minimal Collection")
      expect(openApiSpec.info.description).toBe("Just a name and description")
    })
  })

  describe("Special Characters and Encoding", () => {
    it("should handle URLs with special characters", () => {
      const collection: Collection = {
        id: "col1",
        name: "Special Chars Test",
        requests: {
          req1: {
            id: "req1",
            name: "Request with Special URL",
            method: "GET",
            url: "https://api.example.com/search?q=hello%20world&filter=<test>",
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Special Chars Test")
      expect(Object.keys(openApiSpec.paths || {}).length).toBeGreaterThan(0)
    })

    it("should handle request names with special characters", () => {
      const collection: Collection = {
        id: "col1",
        name: "Special Names",
        requests: {
          req1: {
            id: "req1",
            name: "Request: GET /users (v1) - 测试",
            method: "GET",
            url: "https://api.example.com/users",
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Special Names")
    })

    it("should handle very long request/folder names", () => {
      const longName = "A".repeat(500)
      const collection: Collection = {
        id: "col1",
        name: longName,
        requests: {
          req1: {
            id: "req1",
            name: "Long Name Request " + "B".repeat(500),
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title.length).toBeGreaterThan(100)
    })
  })

  describe("Malformed Data Handling", () => {
    it("should handle requests with empty URLs", () => {
      const collection: Collection = {
        id: "col1",
        name: "Empty URL Test",
        requests: {
          req1: {
            id: "req1",
            name: "Empty URL Request",
            method: "GET",
            url: "",
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Empty URL Test")
    })

    it("should handle requests with relative URLs", () => {
      const collection: Collection = {
        id: "col1",
        name: "Relative URL Test",
        requests: {
          req1: {
            id: "req1",
            name: "Relative URL",
            method: "GET",
            url: "/api/users",
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Relative URL Test")
    })

    it("should handle requests with variable placeholders in URLs", () => {
      const collection: Collection = {
        id: "col1",
        name: "Variable Placeholder Test",
        requests: {
          req1: {
            id: "req1",
            name: "Variable URL",
            method: "GET",
            url: "{{baseUrl}}/api/{{version}}/users/{{userId}}",
            headers: {},
            queryParams: {},
            pathParams: {
              p1: { id: "p1", name: "userId", value: "123" },
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Variable Placeholder Test")
    })
  })

  describe("Large Collections", () => {
    it("should handle collection with many requests", () => {
      const requests: Record<string, any> = {}
      const requestIds: string[] = []

      // Create 100 requests
      for (let i = 0; i < 100; i++) {
        const id = `req${i}`
        requests[id] = {
          id,
          name: `Request ${i}`,
          method: i % 4 === 0 ? "GET" : i % 4 === 1 ? "POST" : i % 4 === 2 ? "PUT" : "DELETE",
          url: `https://api.example.com/resource${i}`,
          headers: {},
          queryParams: {},
          pathParams: {},
          body: { type: "none" },
          authentication: { type: "none" },
        }
        requestIds.push(id)
      }

      const collection: Collection = {
        id: "col1",
        name: "Large Collection",
        requests,
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "root",
            childFolderIds: [],
            requestIds,
          },
        },
      }

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Large Collection")
      expect(Object.keys(openApiSpec.paths || {}).length).toBeGreaterThanOrEqual(50)
    })

    it("should handle collection with deeply nested folders", () => {
      const folders: Record<string, any> = {
        [RootCollectionFolderId]: {
          id: RootCollectionFolderId,
          name: "root",
          childFolderIds: ["folder1"],
          requestIds: [],
        },
      }

      // Create nested folder structure (5 levels deep)
      let parentId = RootCollectionFolderId
      for (let i = 1; i <= 5; i++) {
        const folderId = `folder${i}`
        folders[folderId] = {
          id: folderId,
          name: `Level ${i}`,
          childFolderIds: i < 5 ? [`folder${i + 1}`] : [],
          requestIds:
            i === 5
              ? [
                  `req${i}`,
                ]
              : [],
        }
        if (i === 5) {
          const requests: Record<string, any> = {}
          requests[`req${i}`] = {
            id: `req${i}`,
            name: "Nested Request",
            method: "GET",
            url: "https://api.example.com/nested",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: { type: "none" },
          }

          const collection: Collection = {
            id: "col1",
            name: "Deeply Nested",
            requests,
            folders,
          }

          const openApiSpec = nativeToOpenApi(collection)
          expect(openApiSpec.info.title).toBe("Deeply Nested")
        }
      }
    })
  })

  describe("Postman Import Edge Cases", () => {
    it("should handle Postman collection with minimal info", () => {
      const postmanCollection = {
        info: { name: "Minimal" },
        item: [],
      }

      const result = postmanToNative(postmanCollection as any)
      expect(result.collection.name).toBe("Minimal")
      expect(Object.keys(result.collection.requests)).toHaveLength(0)
    })

    it("should handle Postman requests without URLs", () => {
      const postmanCollection = {
        info: { name: "No URL Test" },
        item: [
          {
            name: "Request Without URL",
            request: {
              method: "GET",
              // Missing URL
            },
          },
        ],
      }

      const result = postmanToNative(postmanCollection as any)
      expect(result.collection.name).toBe("No URL Test")
    })

    it("should handle Postman with empty item arrays", () => {
      const postmanCollection = {
        info: { name: "Empty Items" },
        item: [
          {
            name: "Empty Folder",
            item: [],
          },
        ],
      }

      const result = postmanToNative(postmanCollection as any)
      expect(result.collection.name).toBe("Empty Items")
    })

    it("should handle Postman with mixed request and folder items", () => {
      const postmanCollection = {
        info: { name: "Mixed Items" },
        item: [
          {
            name: "Request 1",
            request: {
              method: "GET",
              url: { raw: "https://api.example.com/1" },
            },
          },
          {
            name: "Folder 1",
            item: [
              {
                name: "Request 2",
                request: {
                  method: "POST",
                  url: { raw: "https://api.example.com/2" },
                },
              },
            ],
          },
          {
            name: "Request 3",
            request: {
              method: "DELETE",
              url: { raw: "https://api.example.com/3" },
            },
          },
        ],
      }

      const result = postmanToNative(postmanCollection as any)
      expect(result.collection.name).toBe("Mixed Items")
      expect(Object.keys(result.collection.requests).length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("Authentication Edge Cases", () => {
    it("should handle missing authentication type", () => {
      const collection: Collection = {
        id: "col1",
        name: "Missing Auth Type",
        requests: {
          req1: {
            id: "req1",
            name: "No Auth",
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Missing Auth Type")
    })

    it("should handle multiple authentication methods in collection", () => {
      const collection: Collection = {
        id: "col1",
        name: "Multiple Auth",
        requests: {
          req1: {
            id: "req1",
            name: "Basic Auth Request",
            method: "GET",
            url: "https://api.example.com/basic",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: {
              type: "basic",
              basic: { username: "user", password: "pass" },
            },
          },
          req2: {
            id: "req2",
            name: "Bearer Auth Request",
            method: "GET",
            url: "https://api.example.com/bearer",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: { type: "none" },
            authentication: { type: "bearer", bearer: { token: "token123" } },
          },
          req3: {
            id: "req3",
            name: "No Auth Request",
            method: "GET",
            url: "https://api.example.com/public",
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
            requestIds: ["req1", "req2", "req3"],
          },
        },
      }

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Multiple Auth")
      expect(Object.keys(openApiSpec.paths || {}).length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("Body Type Edge Cases", () => {
    it("should handle large text body", () => {
      const largeBody = "A".repeat(10000)
      const collection: Collection = {
        id: "col1",
        name: "Large Body",
        requests: {
          req1: {
            id: "req1",
            name: "Large Body Request",
            method: "POST",
            url: "https://api.example.com/upload",
            headers: { h1: { id: "h1", name: "Content-Type", value: "application/json", enabled: true } },
            queryParams: {},
            pathParams: {},
            body: { type: "text", content: largeBody },
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Large Body")
    })

    it("should handle form data with many fields", () => {
      const formData: Record<string, any> = {}
      for (let i = 0; i < 50; i++) {
        formData[`field${i}`] = {
          id: `f${i}`,
          key: `field${i}`,
          value: `value${i}`,
          kind: "text",
        }
      }

      const collection: Collection = {
        id: "col1",
        name: "Many Form Fields",
        requests: {
          req1: {
            id: "req1",
            name: "Form with Many Fields",
            method: "POST",
            url: "https://api.example.com/form",
            headers: {},
            queryParams: {},
            pathParams: {},
            body: {
              type: "form",
              encoding: "multipart",
              formData,
            },
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Many Form Fields")
    })
  })

  describe("Validation Edge Cases", () => {
    it("should handle validation with missing fields", () => {
      const incompleteDocument = {
        version: "1.0.0",
        // Missing format and collection
      }

      const result = validateNativeDocument(incompleteDocument)
      expect(result.success).toBe(false)
    })

    it("should handle validation with null values", () => {
      const documentWithNull = {
        format: "native",
        version: "1.0.0",
        collection: null,
      }

      const result = validateNativeDocument(documentWithNull)
      expect(result.success).toBe(false)
    })

    it("should reject documents with wrong format value", () => {
      const wrongFormat = {
        format: "postman",
        version: "1.0.0",
        collection: {},
      }

      const result = validateNativeDocument(wrongFormat)
      expect(result.success).toBe(false)
    })
  })

  describe("Parameter Edge Cases", () => {
    it("should handle requests with many query parameters", () => {
      const queryParams: Record<string, any> = {}
      for (let i = 0; i < 20; i++) {
        queryParams[`q${i}`] = {
          id: `q${i}`,
          name: `param${i}`,
          value: `value${i}`,
          enabled: i % 3 !== 0, // Some disabled
        }
      }

      const collection: Collection = {
        id: "col1",
        name: "Many Query Params",
        requests: {
          req1: {
            id: "req1",
            name: "Many Params",
            method: "GET",
            url: "https://api.example.com/search",
            headers: {},
            queryParams,
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Many Query Params")
    })

    it("should handle requests with many path parameters", () => {
      const pathParams: Record<string, any> = {}
      for (let i = 0; i < 10; i++) {
        pathParams[`p${i}`] = {
          id: `p${i}`,
          name: `param${i}`,
          value: `value${i}`,
        }
      }

      const collection: Collection = {
        id: "col1",
        name: "Many Path Params",
        requests: {
          req1: {
            id: "req1",
            name: "Path Params",
            method: "GET",
            url: "https://api.example.com/a/b/c/d/e/f/g/h",
            headers: {},
            queryParams: {},
            pathParams,
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

      const openApiSpec = nativeToOpenApi(collection)
      expect(openApiSpec.info.title).toBe("Many Path Params")
    })
  })
})
