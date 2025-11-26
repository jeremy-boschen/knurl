import { describe, it, expect, beforeEach, vi } from "vitest"
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks"

import {
  resolveVariablesPhase,
  createAuthPhase,
  protocolDispatchPhase,
  runPipeline,
  type RequestContext,
  type PipelineNotifier,
} from "./pipeline"
import type { RequestState, Environment, ResponseState, AuthResult } from "@/types"
import { HttpEngine } from "./http/engine"

// Mock the HTTP engine module
vi.mock("./http/engine", () => ({
  HttpEngine: {
    execute: vi.fn(),
  },
}))

// Mock environment resolution
vi.mock("@/lib/environments", () => ({
  resolveRequestVariables: vi.fn((request, env) => {
    if (!env) return request
    const resolved = { ...request }
    const varMap: Record<string, string> = {}
    Object.values(env.variables || {}).forEach((v: any) => {
      if (v.enabled !== false && v.name) {
        varMap[v.name] = v.value
      }
    })
    let url = request.url
    Object.entries(varMap).forEach(([name, value]) => {
      url = url.replace(`{{${name}}}`, value)
    })
    resolved.url = url
    if (request.headers && request.headers.length > 0) {
      resolved.headers = request.headers.map((h: any) => {
        let value = h.value
        Object.entries(varMap).forEach(([name, val]) => {
          value = value.replace(`{{${name}}}`, val)
        })
        return { ...h, value }
      })
    }
    return resolved
  }),
}))

// Mock Tauri bindings for authentication
vi.mock("@/bindings/knurl", () => ({
  getAuthenticationResult: vi.fn(async (auth, _reqId) => {
    if (auth.type === "bearer") {
      return { scheme: "Bearer", credentials: "mock-token-123" } as AuthResult
    }
    if (auth.type === "basic") {
      return {
        scheme: "Basic",
        credentials: btoa(`${auth.username}:${auth.password}`),
      } as AuthResult
    }
    if (auth.type === "apiKey") {
      return {
        scheme: auth.placement === "header" ? "ApiKey" : "query",
        credentials: auth.value,
      } as AuthResult
    }
    return { scheme: "", credentials: "" } as AuthResult
  }),
}))

function createMockRequest(overrides: Partial<RequestState> = {}): RequestState {
  return {
    id: "req-123",
    collectionId: "col-123",
    name: "Test Request",
    method: "GET",
    url: "http://example.com/api",
    headers: [],
    queryParams: [],
    pathParams: [],
    body: { type: "none", raw: "" },
    authentication: { type: "none" },
    ...overrides,
  } as RequestState
}

function createMockEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    id: "env-123",
    name: "Test Env",
    variables: {
      "var-1": {
        id: "var-1",
        name: "BASE_URL",
        value: "http://api.example.com",
        enabled: true,
      },
      "var-2": {
        id: "var-2",
        name: "API_KEY",
        value: "secret-key-123",
        enabled: true,
      },
    },
    ...overrides,
  } as Environment
}

describe("RequestPipeline", () => {
  beforeEach(() => {
    clearMocks()
    mockIPC(() => {}, { shouldMockEvents: true })
    vi.clearAllMocks()
  })

  describe("resolveVariablesPhase", () => {
    it("should substitute environment variables in request URL", async () => {
      const request = createMockRequest({ url: "http://{{BASE_URL}}/users" })
      const environment = createMockEnvironment()
      const context: RequestContext = { request, environment, response: {} }
      const result = await resolveVariablesPhase(context)
      expect(result.request.url).toBe("http://http://api.example.com/users")
    })

    it("should substitute multiple variables in headers", async () => {
      const request = createMockRequest({
        headers: [
          { id: "h1", name: "Authorization", value: "Bearer {{API_KEY}}", enabled: true },
          { id: "h2", name: "X-API-Version", value: "v1", enabled: true },
        ],
      })
      const environment = createMockEnvironment()
      const context: RequestContext = { request, environment, response: {} }
      const result = await resolveVariablesPhase(context)
      expect(result.request.headers?.[0]?.value).toBe("Bearer secret-key-123")
    })

    it("should handle missing environment gracefully", async () => {
      const request = createMockRequest({ url: "http://{{BASE_URL}}/users" })
      const context: RequestContext = { request, response: {} }
      const result = await resolveVariablesPhase(context)
      expect(result.request.url).toBe("http://{{BASE_URL}}/users")
    })

    it("should leave unresolved variables as-is", async () => {
      const request = createMockRequest({ url: "http://example.com?token={{UNKNOWN_VAR}}" })
      const environment = createMockEnvironment()
      const context: RequestContext = { request, environment, response: {} }
      const result = await resolveVariablesPhase(context)
      expect(result.request.url).toContain("{{UNKNOWN_VAR}}")
    })
  })

  describe("createAuthPhase", () => {
    it("should not modify context for 'none' authentication", async () => {
      const request = createMockRequest({ authentication: { type: "none" } })
      const mockGet = () => ({
        collectionsApi: {
          getCollection: vi.fn(() => null),
        },
        credentialsCacheApi: {},
      }) as any
      const authPhase = createAuthPhase(mockGet, vi.fn())
      const context: RequestContext = { request, response: {} }
      const result = await authPhase(context)
      expect(result.authResult).toBeUndefined()
    })

    it("should handle bearer token authentication", async () => {
      const request = createMockRequest({
        authentication: {
          type: "bearer",
          bearer: { token: "my-token", scheme: "Bearer", placement: "header" },
        },
      })
      const mockGet = () => ({
        collectionsApi: { getCollection: vi.fn(() => null) },
        credentialsCacheApi: {
          generateCacheKey: vi.fn(() => "cache-key"),
          get: vi.fn(async () => null),
          set: vi.fn(),
        },
      }) as any
      const authPhase = createAuthPhase(mockGet, vi.fn())
      const context: RequestContext = { request, response: {} }
      const result = await authPhase(context)
      expect(result.authResult?.scheme).toBe("Bearer")
    })

    it("should throw error when inheriting auth from missing collection", async () => {
      const request = createMockRequest({
        collectionId: "unknown-col",
        authentication: { type: "inherit" },
      })
      const mockGet = () => ({
        collectionsApi: { getCollection: vi.fn(() => null) },
        credentialsCacheApi: {},
      }) as any
      const authPhase = createAuthPhase(mockGet, vi.fn())
      const context: RequestContext = { request, response: {} }
      await expect(authPhase(context)).rejects.toThrow('Cannot inherit authentication')
    })
  })

  describe("protocolDispatchPhase", () => {
    it("should dispatch HTTP requests to HttpEngine", async () => {
      const mockResponse: ResponseState = {
        status: 200,
        statusText: "OK",
        body: "response",
        headers: [],
        duration: 100,
        timestamp: new Date().toISOString(),
        url: "http://example.com/api",
        method: "GET",
      }
      vi.mocked(HttpEngine.execute).mockResolvedValue(mockResponse)
      const request = createMockRequest({ url: "http://example.com/api" })
      const context: RequestContext = { request, response: {} }
      const result = await protocolDispatchPhase(context)
      expect(HttpEngine.execute).toHaveBeenCalledWith(context)
      expect(result.response).toEqual(mockResponse)
    })

    it("should throw error for unsupported protocol", async () => {
      const request = createMockRequest({ url: "ftp://example.com/file" })
      const context: RequestContext = { request, response: {} }
      await expect(protocolDispatchPhase(context)).rejects.toThrow("Unsupported protocol: ftp")
    })
  })

  describe("runPipeline", () => {
    it("should execute phases in sequence", async () => {
      const mockResponse: ResponseState = {
        status: 200,
        statusText: "OK",
        body: "response",
        headers: [],
        duration: 100,
        timestamp: new Date().toISOString(),
        url: "http://example.com/api",
        method: "GET",
      }
      vi.mocked(HttpEngine.execute).mockResolvedValue(mockResponse)
      const request = createMockRequest({ url: "http://{{BASE_URL}}/api" })
      const environment = createMockEnvironment()
      const notifier: PipelineNotifier = {
        onStart: vi.fn(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
        onLog: vi.fn(),
      }
      const initialContext: RequestContext = { request, environment, response: {} }
      await runPipeline([resolveVariablesPhase, protocolDispatchPhase], initialContext, notifier)
      expect(notifier.onStart).toHaveBeenCalled()
      expect(notifier.onSuccess).toHaveBeenCalledWith(mockResponse)
    })

    it("should call onError when phase throws", async () => {
      const request = createMockRequest({ url: "ftp://example.com/file" })
      const notifier: PipelineNotifier = {
        onStart: vi.fn(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
        onLog: vi.fn(),
      }
      const initialContext: RequestContext = { request, response: {} }
      await runPipeline([protocolDispatchPhase], initialContext, notifier)
      expect(notifier.onStart).toHaveBeenCalled()
      expect(notifier.onError).toHaveBeenCalled()
    })
  })
})
