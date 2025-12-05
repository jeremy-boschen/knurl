import { beforeEach, describe, expect, it, vi } from "vitest"

const httpEngineMock = vi.hoisted(() => ({ execute: vi.fn(async () => ({ body: undefined, status: 200, headers: [] })) }))
const wsEngineMock = vi.hoisted(() => ({ execute: vi.fn(async () => ({ status: 101 })) }))

vi.mock("@/request/http/engine", () => ({ HttpEngine: httpEngineMock }))
vi.mock("@/request/ws/engine", () => ({ WebSocketEngine: wsEngineMock }))

import { createAuthPhase, protocolDispatchPhase, resolveVariablesPhase, runPipeline } from "./pipeline"

vi.mock("@/lib/environments", () => ({
  resolveRequestVariables: vi.fn((req) => ({ ...req, resolved: true })),
}))

vi.mock("@/bindings/knurl", () => ({
  getAuthenticationResult: vi.fn(async () => ({ headers: { Authorization: "Bearer t" } })),
  sendHttpRequest: vi.fn(async () => ({
    requestId: "req-1",
    status: 200,
    statusText: "OK",
    headers: [],
    body: undefined,
    cookies: [],
    duration: 1,
    size: 0,
    timestamp: Date.now(),
  })),
}))

const baseRequest = { id: "r1", collectionId: "c1", url: "https://example.com", authentication: { type: "none" } }

describe("request pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("resolves variables with environment", async () => {
    const ctx = { request: baseRequest, environment: { id: "env" } as any, response: {} }
    const next = await resolveVariablesPhase(ctx as any)
    expect(next.request).toHaveProperty("resolved", true)
  })

  it("throws when inheriting auth without collection", async () => {
    const get = () =>
      ({
        collectionsApi: { getCollection: () => undefined },
      }) as any
    const phase = createAuthPhase(get, vi.fn())
    await expect(phase({ request: { ...baseRequest, authentication: { type: "inherit" } }, response: {} } as any)).rejects
      .toThrow(/collection "c1" not found/)
  })

  it("uses credential cache when available", async () => {
    const set = vi.fn()
    const getAuth = vi.fn(() => ({ cached: true }))
    const get = () =>
      ({
        collectionsApi: { getCollection: () => ({ id: "c1", authentication: { type: "none" } }) },
        credentialsCacheApi: {
          generateCollectionCacheKey: vi.fn(() => "cache-key"),
          generateCacheKey: vi.fn(() => "cache-key"),
          get: getAuth,
          set,
        },
      }) as any
    const phase = createAuthPhase(get, vi.fn())
    const ctx = await phase({
      request: { ...baseRequest, authentication: { type: "bearer", bearer: { token: "t" } } },
      response: {},
    } as any)
    expect(ctx.authResult).toEqual({ cached: true })
    expect(set).not.toHaveBeenCalled()
  })

  it("dispatches to protocol engine and errors on unsupported protocol", async () => {
    const ctx = { request: { ...baseRequest, url: "https://example.com" }, response: {} }
    await protocolDispatchPhase(ctx as any)
    expect(httpEngineMock.execute).toHaveBeenCalled()

    await expect(
      protocolDispatchPhase({ request: { ...baseRequest, url: "ftp://example.com" }, response: {} } as any),
    ).rejects.toThrow(/Unsupported protocol/)
  })

  it("runs phases and notifies success and error", async () => {
    const notifier = { onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn(), onLog: vi.fn() }
    const phases = [
      async (ctx: any) => ({ ...ctx, response: { ok: true } }),
      async () => {
        throw new Error("boom")
      },
    ]
    await runPipeline([phases[0]], { request: baseRequest, response: {} } as any, notifier)
    expect(notifier.onSuccess).toHaveBeenCalledWith({ ok: true })

    await runPipeline(phases, { request: baseRequest, response: {} } as any, notifier)
    expect(notifier.onError).toHaveBeenCalled()
  })
})
