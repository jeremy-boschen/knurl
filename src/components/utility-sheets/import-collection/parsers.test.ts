import { describe, expect, it } from "vitest"

import { RootCollectionFolderId } from "@/types"

import { isPostmanCollection, openApiToNative, postmanToNative, validatePostmanDocument } from "./parsers"

describe("openApiToNative", () => {
  const baseSpec = {
    openapi: "3.1.0",
    info: { title: "Sample API", version: "1.0.0" },
    paths: {
      "/users": {
        get: {
          summary: "List Users",
          tags: ["Users", "People"],
          responses: {
            default: { description: "ok" },
          },
        },
      },
      "/orders": {
        post: {
          summary: "Create Order",
          tags: ["Orders"],
          responses: {
            default: { description: "created" },
          },
        },
      },
      "/health": {
        get: {
          summary: "Health",
          responses: {
            default: { description: "ok" },
          },
        },
      },
    },
  } as const

  it("groups requests into folders by their first tag by default", () => {
    const result = openApiToNative(baseSpec)

    const folders = result.collection.folders ?? {}
    const root = folders[RootCollectionFolderId]
    expect(root).toBeDefined()
    expect(root?.childFolderIds.length).toBe(2)

    const [usersFolderId, ordersFolderId] = root!.childFolderIds
    expect(folders[usersFolderId]?.name).toBe("Users")
    expect(folders[ordersFolderId]?.name).toBe("Orders")

    const requests = Object.values(result.collection.requests ?? {})
    const usersRequest = requests.find((req) => req.name === "List Users")
    const ordersRequest = requests.find((req) => req.name === "Create Order")
    const healthRequest = requests.find((req) => req.name === "Health")

    expect(usersRequest?.folderId).toBe(usersFolderId)
    expect(ordersRequest?.folderId).toBe(ordersFolderId)
    expect(healthRequest?.folderId).toBe(RootCollectionFolderId)

    expect(folders[usersFolderId]?.requestIds).toContain(usersRequest?.id)
    expect(folders[ordersFolderId]?.requestIds).toContain(ordersRequest?.id)
    expect(root?.requestIds).toContain(healthRequest?.id)
  })

  it("keeps all requests in the root folder when grouping is disabled", () => {
    const result = openApiToNative(baseSpec, { groupByTags: false })

    const folders = result.collection.folders ?? {}
    const root = folders[RootCollectionFolderId]
    expect(root?.childFolderIds.length).toBe(0)

    const requests = Object.values(result.collection.requests ?? {})
    expect(requests).not.toHaveLength(0)
    for (const request of requests) {
      expect(request.folderId).toBe(RootCollectionFolderId)
      expect(root?.requestIds).toContain(request.id)
    }
  })
})

describe("postmanToNative", () => {
  const collection = {
    info: {
      name: "Sample Postman",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      {
        key: "token",
        value: "shhh",
        type: "secret",
      },
    ],
    item: [
      {
        name: "User Operations",
        item: [
          {
            name: "List Users",
            request: {
              method: "GET",
              header: [
                {
                  key: "Authorization",
                  value: "Bearer {{token}}",
                },
              ],
              body: {
                mode: "raw",
                raw: '{"sample":true}',
                options: {
                  raw: {
                    language: "json",
                  },
                },
              },
              url: {
                raw: "https://api.example.com/users?limit=10",
                protocol: "https",
                host: ["api", "example", "com"],
                path: ["users"],
                query: [
                  {
                    key: "limit",
                    value: "10",
                  },
                ],
              },
            },
            event: [
              {
                listen: "test",
                script: {
                  exec: ['pm.test("status code", function () {', "  pm.response.to.be.ok", "})"],
                },
              },
            ],
          },
        ],
      },
    ],
  }

  it("detects Postman documents via schema heuristics", () => {
    expect(isPostmanCollection(collection)).toBe(true)
  })

  it("converts Postman collections into native exports", () => {
    const validation = validatePostmanDocument(collection)
    expect(validation.success).toBe(true)

    const result = postmanToNative(validation.success ? validation.data : (null as never))
    expect(result.collection.name).toBe("Sample Postman")

    const folderMap = result.collection.folders ?? {}
    const root = folderMap[RootCollectionFolderId]
    expect(root).toBeDefined()
    expect(root.childFolderIds.length).toBe(1)
    const folderId = root?.childFolderIds?.[0]
    const folder = folderId ? folderMap[folderId] : undefined
    expect(folder?.name).toBe("User Operations")

    const requests = Object.values(result.collection.requests ?? {})
    expect(requests).toHaveLength(1)
    const request = requests[0]
    expect(request).toBeDefined()
    expect(request.method).toBe("GET")
    expect(request.url).toBe("https://api.example.com/users?limit=10")

    const queryParams = Object.values(request.queryParams)
    expect(queryParams).toHaveLength(1)
    expect(queryParams[0]?.name).toBe("limit")
    expect(queryParams[0]?.value).toBe("10")

    const headers = Object.values(request.headers)
    expect(headers).toHaveLength(1)
    expect(headers[0]?.secure).toBe(true)

    expect(request.body?.type).toBe("text")
    expect(request.body?.language).toBe("json")
    expect(request.tests).toContain("pm.test")

    const environments = Object.values(result.collection.environments ?? {})
    expect(environments).toHaveLength(1)
    const envVariables = Object.values(environments[0]?.variables ?? {})
    expect(envVariables).toHaveLength(1)
    expect(envVariables[0]?.name).toBe("token")
    expect(envVariables[0]?.secure).toBe(true)
  })
})
