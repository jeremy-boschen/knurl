import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/request/prepared-http", () => ({
  prepareHttpRequest: vi.fn(),
}))

import { buildExportCommand } from "./exporters"
import { prepareHttpRequest } from "@/lib/request/prepared-http"
import { createRequestFixture, createExportedCollectionFixture } from "@/test/fixtures/collections"
import type { Collection } from "@/types"

const mockedPrepare = vi.mocked(prepareHttpRequest)

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
  credentialsCacheApi.get.mockClear()
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
})
