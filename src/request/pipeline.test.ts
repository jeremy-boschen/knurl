import { describe, it, vi, expect, beforeEach } from "vitest"
import {
  resolveVariablesPhase,
  protocolDispatchPhase,
  type PipelineNotifier,
  type RequestContext,
} from "@/request/pipeline"
import { WebSocketEngine } from "@/request/ws/engine"
import type { RequestState } from "@/types"
import * as knurl from "@/bindings/knurl"

// Mock bindings and only the WebSocketEngine
vi.mock("@/bindings/knurl", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // Provide fakes used by these tests; tests will set return values per-case
    sendHttpRequest: vi.fn(),
    getAuthenticationResult: vi.fn(),
  }
})
vi.mock("@/request/ws/engine")

describe("Request Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const _mockNotifier: PipelineNotifier = {
    onStart: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
    onLog: vi.fn(),
  }

  const baseRequest: Partial<RequestState> = {
    method: "GET",
    headers: {},
    queryParams: {},
    body: { type: "none" },
  }

  it("should dispatch to HttpEngine for http URLs", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue({
      requestId: "req-123",
      status: 200,
      statusText: "OK",
      headers: [],
      cookies: [],
      body: new ArrayBuffer(0),
      size: 0,
      duration: 10,
      timestamp: new Date().toISOString(),
    })

    const initialContext: RequestContext = {
      request: {
        ...baseRequest,
        url: "http://example.com",
      } as RequestState,
      response: {},
    }

    const phases = [protocolDispatchPhase]
    await phases[0](initialContext) // Manually call phase

    expect(knurl.sendHttpRequest).toHaveBeenCalledOnce()
  })

  it("should dispatch to WebSocketEngine for ws URLs", async () => {
    const initialContext: RequestContext = {
      request: {
        ...baseRequest,
        url: "ws://example.com",
      } as RequestState,
      response: {},
    }

    const phases = [protocolDispatchPhase]
    await phases[0](initialContext) // Manually call phase

    expect(WebSocketEngine.execute).toHaveBeenCalledOnce()
  })

  it("should resolve environment variables", async () => {
    const initialContext: RequestContext = {
      request: {
        ...baseRequest,
        url: "{{baseUrl}}/users",
      } as RequestState,
      environment: {
        id: "env1",
        name: "Test Env",
        variables: {
          baseUrl: { id: "v1", name: "baseUrl", value: "https://api.example.com", secure: false, enabled: true },
        },
      } as any,
      response: {},
    }

    const finalContext = await resolveVariablesPhase(initialContext)
    expect(finalContext.request.url).toBe("https://api.example.com/users")
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: pipeline.resolveVariables.test.ts
// ---------------------------------------------------------------------------
import type { Environment } from "@/types"
describe("resolveVariablesPhase", () => {
  function makeCtx(partial: Partial<RequestState>, env?: Partial<Environment>): RequestContext {
    return {
      request: {
        id: "req-1",
        collectionId: "col-1",
        name: "Test",
        method: "GET",
        url: partial.url ?? "https://{{host}}/users/{{userId}}?q={{q}}&q2={{q}}",
        headers: {
          h1: { id: "h1", name: "X-Test", value: "{{token}}", enabled: true },
        },
        queryParams: {
          q: { id: "q", name: "q", value: "{{query}}", enabled: true },
        },
        pathParams: {
          userId: { id: "p1", name: "userId", value: "{{uid}}" },
        },
        body: { type: "none" },
        ...partial,
      } as RequestState,
      environment: (env
        ? {
            id: "env-1",
            name: "Env",
            variables: env.variables ?? ({} as Environment["variables"]),
          }
        : undefined) as Environment | undefined,
      response: {},
    }
  }

  it("replaces placeholders across url, headers, query and path; repeated placeholders handled", async () => {
    const context = makeCtx({}, {
      variables: {
        host: { id: "v1", name: "host", value: "api.example.com", secure: false, enabled: true },
        uid: { id: "v2", name: "uid", value: "42", secure: false, enabled: true },
        query: { id: "v3", name: "query", value: "hello", secure: false, enabled: true },
        token: { id: "v4", name: "token", value: "abc-{{ignored}}-123", secure: false, enabled: true },
        ignored: { id: "v5", name: "ignored", value: "REPLACED", secure: false, enabled: true },
      },
    })

    const out = await resolveVariablesPhase(context)
    expect(out.request.url).toBe("https://api.example.com/users/42?q=hello&q2=hello")
    const headerValue = Object.values(out.request.headers!)[0].value
    expect(headerValue).toBe("abc-{{ignored}}-123")
  })

  it("treats variables without explicit enabled flag as active", async () => {
    const context = makeCtx(
      {
        url: "{{baseUrl}}/status",
      },
      {
        variables: {
          baseUrl: { id: "v1", name: "baseUrl", value: "https://internal.example", secure: false },
        },
      },
    )

    const out = await resolveVariablesPhase(context)
    expect(out.request.url).toBe("https://internal.example/status")
  })

  it("leaves unknown placeholders intact", async () => {
    const ctx = makeCtx({}, {
      variables: {
        host: { id: "v1", name: "host", value: "api.example.com", secure: false, enabled: true },
      },
    })

    const out = await resolveVariablesPhase(ctx)
    expect(out.request.url).toContain("{{userId}}")
    expect(out.request.url).toContain("{{q}}")
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: pipeline.protocol-errors.test.ts
// ---------------------------------------------------------------------------
describe("protocolDispatchPhase errors", () => {
  function makeCtx(url: string): RequestContext {
    return {
      request: {
        id: "r1",
        collectionId: "c1",
        name: "Req",
        method: "GET",
        url,
        headers: {},
        queryParams: {},
        body: { type: "none" },
      } as RequestState,
      response: {},
    }
  }

  it("throws for unsupported protocol", async () => {
    const ctx = makeCtx("ftp://example.com")
    await expect(protocolDispatchPhase(ctx)).rejects.toThrow(/Unsupported protocol: ftp/)
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: pipeline.e2e-smoke.test.ts
// ---------------------------------------------------------------------------
import { runPipeline } from "@/request/pipeline"
describe("Request pipeline e2e smoke (mocked)", () => {
  it("flows through phases and returns mapped response on success", async () => {
    const notifier: PipelineNotifier = {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
      onLog: vi.fn(),
    }

    vi.mocked(knurl.sendHttpRequest).mockResolvedValue({
      requestId: "corr-p1",
      status: 200,
      statusText: "OK",
      headers: [["X-Test", "1"]],
      cookies: [],
      body: new TextEncoder().encode("{}"),
      size: 2,
      duration: 5,
      timestamp: new Date().toISOString(),
    } as any)

    const initial: RequestContext = {
      correlationId: "corr-p1",
      request: {
        id: "r1",
        collectionId: "c1",
        name: "Req",
        method: "GET",
        url: "https://{{host}}/ping",
        headers: {},
        queryParams: {},
        body: { type: "none" },
      } as RequestState,
      environment: {
        id: "e1",
        name: "env",
        variables: {
          host: { id: "v1", name: "host", value: "example.com", secure: false, enabled: true },
        },
      } as Environment,
      response: {},
    }

    await runPipeline([resolveVariablesPhase, protocolDispatchPhase], initial, notifier)

    expect(notifier.onStart).toHaveBeenCalledOnce()
    expect(notifier.onError).not.toHaveBeenCalled()
    expect(notifier.onSuccess).toHaveBeenCalledOnce()
    const resp = vi.mocked(notifier.onSuccess).mock.calls[0][0]
    expect(resp.data.type).toBe("http")
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    expect(call.url).toBe("https://example.com/ping")
  })

  it("surfaces backend errors via notifier.onError", async () => {
    const notifier: PipelineNotifier = {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
      onLog: vi.fn(),
    }

    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(new Error("boom"))

    const initial: RequestContext = {
      request: {
        id: "r1",
        collectionId: "c1",
        name: "Req",
        method: "GET",
        url: "http://example.com",
        headers: {},
        queryParams: {},
        body: { type: "none" },
      } as RequestState,
      response: {},
    }

    await runPipeline([protocolDispatchPhase], initial, notifier)

    expect(notifier.onStart).toHaveBeenCalledOnce()
    expect(notifier.onError).toHaveBeenCalledOnce()
    expect(notifier.onSuccess).not.toHaveBeenCalled()
    const err = vi.mocked(notifier.onError).mock.calls[0][0]
    expect(err).toBeInstanceOf(Error)
    expect(String(err.message || err)).toMatch(/boom/)
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: pipeline.inherit-cache.test.ts
// ---------------------------------------------------------------------------
import { createAuthPhase } from "@/request/pipeline"
import type { ApplicationState } from "@/types/application"
import { getAuthenticationResult } from "@/bindings/knurl"
describe("auth inherit cache + strategy", () => {
  const makeState = (overrides?: Partial<ApplicationState>): ApplicationState => ({
    collectionsState: {
      index: [{ id: "col-1", name: "C1", count: 1 }],
      cache: {
        "col-1": {
          id: "col-1",
          name: "C1",
          updated: new Date().toISOString(),
          encryption: { algorithm: "aes-gcm" },
          environments: {},
          requests: {},
          authentication: { type: "oauth2", oauth2: { grantType: "client_credentials", tokenCaching: "always" } as any },
        },
      },
    },
    credentialsCacheState: { cache: {}, key: null },
    credentialsCacheApi: {
      set: vi.fn(async function (this: any, key: string, result: any) {
        ;(state.credentialsCacheState.cache as any)[key] = btoa(JSON.stringify({ iv: "", c: JSON.stringify(result) }))
        return
      }),
      get: vi.fn(async function (this: any, key: string) {
        return undefined
      }),
      remove: vi.fn(),
      clear: vi.fn(),
      generateCacheKey: (requestId: string) => `request-auth-${requestId}`,
      generateCollectionCacheKey: (collectionId: string) => `collection-auth-${collectionId}`,
    },
    requestTabsState: { activeTab: undefined, openTabs: {} } as any,
    settingsState: {} as any,
    getState: undefined as any,
    setState: undefined as any,
    storageManager: undefined as any,
    collectionsApi: {} as any,
    requestTabsApi: {} as any,
    sidebarState: {} as any,
    sidebarApi: {} as any,
    settingsApi: {} as any,
  })

  let state = makeState()

  it("uses collection cache key when request inherits", async () => {
    state = makeState()
    const get = () => state
    const set = (_: any) => {}

    const phase = createAuthPhase(get as any, set as any)
    const ctx: RequestContext = {
      request: {
        id: "req-1",
        collectionId: "col-1",
        method: "GET",
        url: "https://example.com",
        pathParams: {},
        queryParams: {},
        headers: {},
        body: { type: "none" },
        authentication: { type: "inherit" },
        autoSave: false,
        options: {},
        patch: {},
        name: "R",
        updated: 0,
      } as RequestState,
      response: {},
    }
    await phase(ctx)

    expect(getAuthenticationResult).toHaveBeenCalled()
    expect((state.credentialsCacheApi.get as any).mock.calls[0][0]).toBe("collection-auth-col-1")
  })

  it("tokenCaching=never fetches fresh token despite cache", async () => {
    state = makeState()
    ;(state.collectionsState.cache["col-1"].authentication as any).oauth2.tokenCaching = "never"
    const get = () => state
    const set = (_: any) => {}
    const phase = createAuthPhase(get as any, set as any)
    const ctx: RequestContext = {
      request: {
        id: "req-1",
        collectionId: "col-1",
        method: "GET",
        url: "https://example.com",
        pathParams: {},
        queryParams: {},
        headers: {},
        body: { type: "none" },
        authentication: { type: "inherit" },
        autoSave: false,
        options: {},
        patch: {},
        name: "R",
        updated: 0,
      } as RequestState,
      response: {},
    }
    await phase(ctx)
    expect(getAuthenticationResult).toHaveBeenCalled()
  })

  it("tokenCaching=always uses cached token when available (no backend call)", async () => {
    state = makeState()
    ;(state.collectionsState.cache["col-1"].authentication as any).oauth2.tokenCaching = "always"
    vi.mocked(getAuthenticationResult).mockClear()
    const cached = { headers: { Authorization: "Bearer CACHED" }, expiresAt: Math.floor(Date.now() / 1000) + 300 }
    ;(state.credentialsCacheApi.get as any) = vi.fn(async () => cached)
    const get = () => state
    const set = (_: any) => {}

    const phase = createAuthPhase(get as any, set as any)
    const ctx: RequestContext = {
      request: {
        id: "req-1",
        collectionId: "col-1",
        method: "GET",
        url: "https://example.com",
        pathParams: {},
        queryParams: {},
        headers: {},
        body: { type: "none" },
        authentication: { type: "inherit" },
        autoSave: false,
        options: {},
        patch: {},
        name: "R",
        updated: 0,
      } as RequestState,
      response: {},
    }

    await phase(ctx)
    expect(state.credentialsCacheApi.get).toHaveBeenCalled()
    expect(getAuthenticationResult).not.toHaveBeenCalled()
    expect(ctx.authResult).toEqual(cached)
  })
})
