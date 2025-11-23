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

  it("creates environments from servers and variables", () => {
    const spec = {
      ...baseSpec,
      servers: [
        { url: "https://api.example.com", description: "Prod" },
        { url: "https://staging.example.com", variables: { region: { default: "us-east-1" } } },
      ],
    }

    const result = openApiToNative(spec)
    const envs = Object.values(result.collection.environments ?? {})
    expect(envs).toHaveLength(2)
    const prod = envs.find((e) => e.name === "Prod")
    const prodVars = Object.values(prod?.variables ?? {})
    expect(prodVars.find((v) => v.name === "baseUrl")?.value).toBe("https://api.example.com")
    const staging = envs.find((e) => e.name?.includes("Server 2"))
    const vars = staging ? Object.values(staging.variables ?? {}) : []
    expect(vars.map((v) => v.name)).toEqual(expect.arrayContaining(["baseUrl", "region"]))
    expect(vars.find((v) => v.name === "region")?.value).toBe("us-east-1")
  })

  it("normalizes path templates, resolves param defaults/examples, and includes requestBody example", () => {
    const spec = {
      openapi: "3.1.0",
      info: { title: "Param API", version: "1.0.0" },
      paths: {
        "/users/{id}": {
          parameters: [
            { name: "q", in: "query", schema: { default: "all" } },
            { name: "id", in: "path", example: "99" },
          ],
          get: {
            summary: "Get User",
            responses: { default: { description: "ok" } },
            requestBody: {
              content: {
                "application/json": {
                  example: { a: 1 },
                },
              },
            },
          },
        },
      },
    } as const

    const result = openApiToNative(spec)
    const req = Object.values(result.collection.requests ?? {})[0]
    expect(req.url).toBe("{{baseUrl}}/users/{{id}}")
    const qp = Object.values(req.queryParams ?? {})[0]
    expect(qp?.value).toBe("all")
    const pp = Object.values(req.pathParams ?? {})[0]
    expect(pp?.value).toBe("99")
    expect(req.body?.type).toBe("text")
    expect(req.body?.content).toContain('"a": 1')
  })

  it("reuses tag folders instead of duplicating them", () => {
    const spec = {
      openapi: "3.1.0",
      info: { title: "Tags API", version: "1.0.0" },
      paths: {
        "/a": { get: { tags: ["Shared"], responses: { default: { description: "ok" } } } },
        "/b": { post: { tags: ["Shared"], responses: { default: { description: "ok" } } } },
      },
    } as const

    const result = openApiToNative(spec)
    const folders = result.collection.folders ?? {}
    const root = folders[RootCollectionFolderId]
    expect(root.childFolderIds.length).toBe(1)
    const sharedId = root.childFolderIds[0]
    const shared = folders[sharedId]
    expect(shared.requestIds.length).toBe(2)
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
    expect(request.tests).toBeUndefined()

    const environments = Object.values(result.collection.environments ?? {})
    expect(environments).toHaveLength(1)
    const envVariables = Object.values(environments[0]?.variables ?? {})
    expect(envVariables).toHaveLength(1)
    expect(envVariables[0]?.name).toBe("token")
    expect(envVariables[0]?.secure).toBe(true)
  })

  it("rejects Postman collections that are not v2.1", () => {
    const legacy = {
      ...collection,
      info: {
        ...collection.info,
        schema: "https://schema.getpostman.com/json/collection/v2.0.0/collection.json",
      },
    }

    const validation = validatePostmanDocument(legacy)
    expect(validation.success).toBe(false)
    const issues = validation.success ? [] : validation.error.issues
    expect(issues[0]?.path).toEqual(["info", "schema"])
    expect(issues[0]?.message).toContain("v2.1")
  })

  it("rejects unsupported request body modes", () => {
    const customMode = JSON.parse(JSON.stringify(collection))
    customMode.item[0].item[0].request.body.mode = "protobuf"

    const validation = validatePostmanDocument(customMode)
    expect(validation.success).toBe(false)
    const issues = validation.success ? [] : validation.error.issues
    expect(issues[0]?.path).toEqual(["item", 0, "item", 0, "request", "body", "mode"])
    expect(issues[0]?.message).toContain("Supported modes")
  })

  it("rejects unsupported auth types", () => {
    const digestAuth = JSON.parse(JSON.stringify(collection))
    digestAuth.item[0].item[0].request.auth = {
      type: "digest",
    }

    const validation = validatePostmanDocument(digestAuth)
    expect(validation.success).toBe(false)
    const issues = validation.success ? [] : validation.error.issues
    expect(issues[0]?.path).toEqual(["item", 0, "item", 0, "request", "auth", "type"])
    expect(issues[0]?.message).toContain("Supported types")
  })
})
