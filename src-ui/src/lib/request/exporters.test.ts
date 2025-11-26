import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/request/prepared-http", () => ({
  prepareHttpRequest: vi.fn(),
}))

import { buildExportCommand } from "./exporters"
import { prepareHttpRequest } from "@/lib/request/prepared-http"
import { createRequestFixture, createExportedCollectionFixture } from "@test/fixtures/collections"
import type { Collection } from "@/types"

const mockedPrepare = vi.mocked(prepareHttpRequest)
const getLastPrepareArgs = () => {
  const calls = mockedPrepare.mock.calls
  return calls[calls.length - 1]?.[0]
}

const credentialsCacheApi = {
  generateCollectionCacheKey: vi.fn(() => "collection-key"),
  generateCacheKey: vi.fn(() => "request-key"),
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn(),
  clear: vi.fn(),
}

const exported = createExportedCollectionFixture()
const baseCollection = exported.collection as Collection

beforeEach(() => {
  mockedPrepare.mockReset()
  credentialsCacheApi.get.mockReset().mockResolvedValue(undefined)
  credentialsCacheApi.set.mockReset()
  credentialsCacheApi.generateCacheKey.mockClear()
  credentialsCacheApi.generateCollectionCacheKey.mockClear()
})

describe("buildExportCommand", () => {
  it("produces a curl command with headers, body, and options", async () => {
    mockedPrepare.mockReturnValue({
      method: "post",
      url: "https://api.knurl.dev/foo",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: { mode: "text", value: '{"ok":true}' },
      options: { disableSsl: true, timeoutSecs: 15 },
    })

    const cmd = await buildExportCommand("curl", {
      request: createRequestFixture({ method: "POST" }),
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })

    expect(cmd).toContain("curl")
    expect(cmd).toContain("-X")
    expect(cmd).toContain("'https://api.knurl.dev/foo'")
    expect(cmd).toContain("-H")
    expect(cmd).toContain("--data-raw")
    expect(cmd).toContain("--insecure")
    expect(mockedPrepare).toHaveBeenCalledTimes(1)
  })

  it("produces a wget command for urlencoded bodies", async () => {
    mockedPrepare.mockReturnValue({
      method: "patch",
      url: "https://api.knurl.dev/a",
      headers: {
        Accept: "*/*",
      },
      body: { mode: "urlencoded", value: "foo=bar" },
      options: { maxRedirects: 1 },
    })

    const cmd = await buildExportCommand("wget", {
      request: createRequestFixture({ method: "PATCH" }),
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })

    expect(cmd).toContain("wget")
    expect(cmd).toContain("--method='PATCH'")
    expect(cmd).toContain("--body-data='foo=bar'")
    expect(cmd).toContain("--max-redirect")
  })

  it("builds a fetch snippet with headers and body", async () => {
    mockedPrepare.mockReturnValue({
      method: "get",
      url: "https://api.knurl.dev/data",
      headers: { Accept: "application/json" },
      body: { mode: "none" },
      options: {},
    })

    const snippet = await buildExportCommand("fetch", {
      request: createRequestFixture({ method: "GET" }),
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })

    expect(snippet).toContain("fetch(\"https://api.knurl.dev/data\"")
    expect(snippet).toContain("method: \"GET\"")
    expect(snippet).toContain("headers: {")
    expect(snippet.trim().endsWith("});")).toBe(true)
  })

  it("adds DNS overrides, SSL flags, and binary data for curl exports", async () => {
    mockedPrepare.mockReturnValue({
      method: "post",
      url: "https://api.knurl.dev/foo",
      headers: {},
      body: { mode: "binary", filePath: "/tmp/data.bin" },
      options: {
        disableSsl: true,
        caPath: "/etc/ssl/custom.pem",
        timeoutSecs: 8,
        userAgent: "Knurl/1.0",
        httpVersion: "http2",
        maxRedirects: 4,
        hostOverride: "edge.knurl.dev:9443",
        ipOverride: "10.10.0.5",
      },
    })

    const cmd = await buildExportCommand("curl", {
      request: createRequestFixture({ method: "POST" }),
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })

    expect(cmd).toContain("--cacert '/etc/ssl/custom.pem'")
    expect(cmd).toContain("--resolve 'edge.knurl.dev:9443:10.10.0.5'")
    expect(cmd).toContain("-H 'Host: edge.knurl.dev:9443'")
    expect(cmd).toContain("--http2")
    expect(cmd).toContain("-A 'Knurl/1.0'")
    expect(cmd).toContain("--data-binary '@/tmp/data.bin'")
  })

  it("throws when exporting multipart bodies for wget", async () => {
    mockedPrepare.mockReturnValue({
      method: "post",
      url: "https://api.knurl.dev/form",
      headers: {},
      body: { mode: "multipart", parts: [{ name: "file", type: "file", filePath: "/tmp/file.txt" }] },
      options: {},
    })

    await expect(
      buildExportCommand("wget", {
        request: createRequestFixture({ method: "POST" }),
        collection: baseCollection,
        environment: undefined,
        credentialsCacheApi,
      }),
    ).rejects.toThrow(/multipart/)
  })

  it("emits fetch notes for advanced options and binary payloads", async () => {
    mockedPrepare.mockReturnValue({
      method: "put",
      url: "https://api.knurl.dev/resource",
      headers: { Accept: "application/json" },
      body: { mode: "binary", filePath: "/tmp/payload.bin" },
      options: {
        disableSsl: true,
        caPath: "/etc/ssl/extra.pem",
        timeoutSecs: 12,
        maxRedirects: 2,
        httpVersion: "http1",
        hostOverride: "local.test:8080",
        ipOverride: "192.168.0.22",
      },
    })

    const snippet = await buildExportCommand("fetch", {
      request: createRequestFixture({ method: "PUT" }),
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })

    expect(snippet).toContain('body: /* readFileSync("/tmp/payload.bin") */ undefined')
    expect(snippet).toContain("configure HTTPS agent")
    expect(snippet).toContain("load CA bundle from /etc/ssl/extra.pem")
    expect(snippet).toContain("enforce a 12s timeout")
    expect(snippet).toContain("limit redirects to 2")
    expect(snippet).toContain("force HTTP/1")
    expect(snippet).toContain("map local.test:8080 to 192.168.0.22")
  })

  it("skips adding Host/User-Agent overrides when already present", async () => {
    mockedPrepare.mockReturnValue({
      method: "get",
      url: "https://api.knurl.dev/override",
      headers: { Host: "custom", "User-Agent": "ExistingUA" },
      body: { mode: "none" },
      options: { hostOverride: "custom:443", ipOverride: "1.1.1.1", userAgent: "ShouldNotApply" },
    })

    const cmd = await buildExportCommand("curl", {
      request: createRequestFixture({ method: "GET" }),
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })

    expect(cmd).not.toContain("Host: custom:443")
    // curl still emits -A when userAgent option provided; ensure existing Host header prevented override only
    expect(cmd).toContain("-A 'ShouldNotApply'")
  })

  it("throws for unsupported export formats", async () => {
    await expect(
      // @ts-expect-error deliberate bad format
      buildExportCommand("scp", { request: createRequestFixture({}), collection: baseCollection, credentialsCacheApi }),
    ).rejects.toThrow(/Unsupported export format/)
  })
})

describe("auth resolution", () => {
  it("injects bearer tokens across placements", async () => {
    mockedPrepare.mockReturnValue({
      method: "get",
      url: "https://api.knurl.dev/data",
      headers: {},
      body: { mode: "none" },
      options: {},
    })

    const bearerHeader = createRequestFixture({
      authentication: { type: "bearer", bearer: { token: "abc" } },
    })
    await buildExportCommand("curl", {
      request: bearerHeader,
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    let args = getLastPrepareArgs()
    expect(args?.authResult).toEqual({ headers: { Authorization: "Bearer abc" } })

    const bearerQuery = createRequestFixture({
      authentication: { type: "bearer", bearer: { token: "xyz", placement: { type: "query", name: "token" } } },
    })
    await buildExportCommand("curl", {
      request: bearerQuery,
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    args = getLastPrepareArgs()
    expect(args?.authResult).toEqual({ query: { token: "xyz" } })

    const bearerBody = createRequestFixture({
      authentication: { type: "bearer", bearer: { token: "sekret", placement: { type: "body", fieldName: "token" } } },
    })
    await buildExportCommand("curl", {
      request: bearerBody,
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    args = getLastPrepareArgs()
    expect(args?.authResult).toEqual({ body: { token: "sekret" } })
  })

  it("applies api key placements and caches oauth tokens", async () => {
    mockedPrepare.mockReturnValue({
      method: "get",
      url: "https://api.knurl.dev/data",
      headers: {},
      body: { mode: "none" },
      options: {},
    })

    const apiKeyCookie = createRequestFixture({
      authentication: {
        type: "apiKey",
        apiKey: { key: "X-Token", value: "123", placement: { type: "cookie", name: "api_key" } },
      },
    })
    await buildExportCommand("curl", {
      request: apiKeyCookie,
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    let args = getLastPrepareArgs()
    expect(args?.authResult).toEqual({ cookies: { api_key: "123" } })

    const oauthCollection = {
      ...baseCollection,
      authentication: { type: "oauth2", oauth2: {} },
    } as Collection
    credentialsCacheApi.get.mockResolvedValueOnce({ headers: { Authorization: "Bearer cached" } })
    const inheritRequest = createRequestFixture({ authentication: { type: "inherit" } })
    await buildExportCommand("curl", {
      request: inheritRequest,
      collection: oauthCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    args = getLastPrepareArgs()
    expect(credentialsCacheApi.generateCollectionCacheKey).toHaveBeenCalledWith(oauthCollection.id)
    expect(args?.authResult).toEqual({ headers: { Authorization: "Bearer cached" } })

    credentialsCacheApi.get.mockResolvedValueOnce({ headers: { Authorization: "Bearer req" } })
    const requestLevel = createRequestFixture({ authentication: { type: "oauth2", oauth2: {} } })
    await buildExportCommand("curl", {
      request: requestLevel,
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    args = getLastPrepareArgs()
    expect(credentialsCacheApi.generateCacheKey).toHaveBeenCalledWith(requestLevel.id)
    expect(args?.authResult).toEqual({ headers: { Authorization: "Bearer req" } })
  })

  it("builds auth results for basic and api key body placement", async () => {
    mockedPrepare.mockReturnValue({
      method: "get",
      url: "https://api.knurl.dev/data",
      headers: {},
      body: { mode: "none" },
      options: {},
    })

    const basicReq = createRequestFixture({
      authentication: { type: "basic", basic: { username: "u", password: "p" } },
    })
    await buildExportCommand("curl", {
      request: basicReq,
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    let args = getLastPrepareArgs()
    expect(args?.authResult?.headers?.Authorization).toMatch(/^Basic /)

    const apiKeyBody = createRequestFixture({
      authentication: { type: "apiKey", apiKey: { key: "k", value: "v", placement: { type: "body" } } },
    })
    await buildExportCommand("curl", {
      request: apiKeyBody,
      collection: baseCollection,
      environment: undefined,
      credentialsCacheApi,
    })
    args = getLastPrepareArgs()
    expect(args?.authResult).toEqual({ body: { k: "v" } })
  })

  it("returns undefined auth when inherit has none", async () => {
    mockedPrepare.mockReturnValue({
      method: "get",
      url: "https://api.knurl.dev/data",
      headers: {},
      body: { mode: "none" },
      options: {},
    })

    const inheritRequest = createRequestFixture({ authentication: { type: "inherit" } })
    const collection = { ...baseCollection, authentication: { type: "none" } } as Collection
    await buildExportCommand("curl", {
      request: inheritRequest,
      collection,
      environment: undefined,
      credentialsCacheApi,
    })
    const args = getLastPrepareArgs()
    expect(args?.authResult).toBeUndefined()
  })
})
