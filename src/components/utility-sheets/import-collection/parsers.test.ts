import { describe, expect, it } from "vitest"

import { RootCollectionFolderId } from "@/types"

import { openApiToNative } from "./parsers"

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
