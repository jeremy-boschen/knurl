import { describe, it, expect, vi, beforeEach } from "vitest"
import { HttpEngine } from "./engine"
import * as knurl from "@/bindings/knurl"
import { isAppError } from "@/bindings/knurl"
import type { RequestContext } from "@/request/pipeline"
import type { RequestState } from "@/types"

vi.mock("@/bindings/knurl", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    sendHttpRequest: vi.fn(),
  }
})

function makeBaseContext(partial: Partial<RequestState> = {}): RequestContext {
  return {
    correlationId: "corr-1",
    request: {
      method: "POST",
      url: "https://api.example.com/users?keep=1",
      headers: {},
      queryParams: {},
      body: { type: "text", content: "hello", language: "text" },
      options: { maxLogBytes: 2048, redactSensitive: true, logBodies: true },
      ...partial,
    } as RequestState,
    response: {},
  }
}

describe("HttpEngine mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps only enabled headers and infers Content-Type for text body", async () => {
    const ctx = makeBaseContext({
      headers: {
        a: { id: "a", name: "X-Enabled", value: "1", enabled: true },
        b: { id: "b", name: "X-Disabled", value: "2", enabled: false },
      },
      body: { type: "text", content: "{\"a\":1}", language: "json" },
    })

    vi.mocked(knurl.sendHttpRequest).mockResolvedValue({
      requestId: "corr-1",
      status: 200,
      statusText: "OK",
      headers: [["Content-Type", "application/json"]],
      cookies: [],
      body: new TextEncoder().encode("{}"),
      size: 2,
      duration: 1,
      timestamp: new Date().toISOString(),
    } as any)

    const res = await HttpEngine.execute(ctx)
    expect(res.data.type).toBe("http")

    // Inspect the call to sendHttpRequest to verify mapping
    expect(knurl.sendHttpRequest).toHaveBeenCalledOnce()
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any

    // Only enabled header propagated and JSON inferred
    expect(call.headers).toMatchObject({ "X-Enabled": "1", "Content-Type": "application/json" })
    // Body should be bytes because method is POST
    expect(call.body).toBeDefined()
    expect(ArrayBuffer.isView(call.body)).toBe(true)
    // Flags passthrough
    expect(call.maxLogBytes).toBe(2048)
    expect(call.redactSensitive).toBe(true)
    expect(call.logBodies).toBe(true)
  })

  it("merges cookies from authResult into Cookie header, preserving existing", async () => {
    const ctx = makeBaseContext({
      headers: {
        cookie: { id: "c", name: "Cookie", value: "a=1", enabled: true },
      },
    })
    const authResult = {
      cookies: { b: "2", c: "3" },
    }

    vi.mocked(knurl.sendHttpRequest).mockResolvedValue({
      requestId: "corr-1",
      status: 200,
      statusText: "OK",
      headers: [],
      cookies: [],
      body: new Uint8Array(),
      size: 0,
      duration: 1,
      timestamp: new Date().toISOString(),
    } as any)

    await HttpEngine.execute({ ...ctx, authResult } as any)

    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    expect(call.headers.Cookie ?? call.headers.cookie).toBe("a=1; b=2; c=3")
  })

  it("auth query params override request params (last-wins)", async () => {
    const ctx = makeBaseContext({
      method: "GET",
      url: "https://api.example.com/search?q=one",
      queryParams: {
        q: { id: "q", name: "q", value: "one", enabled: true },
      },
    })

    const authResult = { query: { q: "two", extra: "x" } }

    vi.mocked(knurl.sendHttpRequest).mockResolvedValue({
      requestId: "corr-1",
      status: 200,
      statusText: "OK",
      headers: [],
      cookies: [],
      body: new Uint8Array(),
      size: 0,
      duration: 1,
      timestamp: new Date().toISOString(),
    } as any)

    await HttpEngine.execute({ ...ctx, authResult } as any)

    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    expect(call.url).toContain("q=two")
    expect(call.url).toContain("extra=x")
  })

  it("throws when auth body placement used with non-form text body", async () => {
    const ctx = makeBaseContext({ body: { type: "text", content: "hello", language: "text" } })
    const authResult = { body: { token: "x" } }

    await expect(HttpEngine.execute({ ...ctx, authResult } as any)).rejects.toThrow(
      /Auth placement 'body' is only supported with form bodies/
    )
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: engine.errors.test.ts
// ---------------------------------------------------------------------------
describe("HttpEngine errors", () => {
  const makeBase = (overrides: Partial<RequestState> = {}): RequestState => ({
    id: "req1",
    name: "Err Test",
    collectionId: "col1",
    autoSave: false,
    method: "GET",
    url: "http://example.com",
    pathParams: {},
    queryParams: {},
    headers: {},
    body: { type: "none" },
    authentication: { type: "none" },
    tests: undefined,
    options: {},
    patch: {},
    updated: 0,
    ...(overrides as any),
  })

  it("throws on invalid URL construction", async () => {
    const request = makeBase({ url: "http://" })
    await expect(HttpEngine.execute({ request, response: {} } as any)).rejects.toBeInstanceOf(Error)
  })

  it("surfaces backend BadRequest for invalid header name", async () => {
    const err: any = new Error("[BadRequest] invalid header name: '\nFoo'")
    err.appError = { kind: "BadRequest", message: "invalid header name: '\nFoo'", timestamp: new Date().toISOString() }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    const request = makeBase({
      headers: {
        h1: { id: "h1", name: "\nFoo", value: "bar", enabled: true, secure: false },
      } as any,
    })

    try {
      await HttpEngine.execute({ request, response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e) {
      expect(isAppError(e as any, "BadRequest")).toBe(true)
      expect((e as any).appError.message).toMatch(/invalid header name/i)
    }
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: engine.multipart.test.ts
// ---------------------------------------------------------------------------
describe("HttpEngine multipart/form-data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeBase = (overrides: Partial<RequestState> = {}): RequestState => ({
    id: "req1",
    name: "Multipart Test",
    collectionId: "col1",
    autoSave: false,
    method: "POST",
    url: "http://example.com/upload",
    pathParams: {},
    queryParams: {},
    headers: {},
    body: {
      type: "form",
      encoding: "multipart",
      formData: {
        a: { id: "a", key: "field1", value: "value1", enabled: true, secure: false },
        b: { id: "b", key: "field2", value: "value2", enabled: true, secure: false },
      },
    },
    authentication: { type: "none" },
    tests: undefined,
    options: {},
    patch: {},
    updated: 0,
    ...(overrides as any),
  })

  const okResponse = {
    requestId: "rid",
    status: 200,
    statusText: "OK",
    headers: [],
    cookies: [],
    body: new Uint8Array(0),
    size: 0,
    duration: 1,
    timestamp: new Date().toISOString(),
  }

  it("delegates all multipart assembly to backend when no Content-Type provided", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue(okResponse as any)

    const request = makeBase()
    await HttpEngine.execute({ request, response: {} } as any)

    expect(knurl.sendHttpRequest).toHaveBeenCalledTimes(1)
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    const ct = Object.entries(call.headers || {}).find(([k]) => k.toLowerCase() === "content-type")?.[1]
    expect(ct).toBeUndefined()
    expect(call.body).toBeUndefined()
    expect(call.multipartParts).toEqual([
      { type: "text", name: "field1", value: "value1" },
      { type: "text", name: "field2", value: "value2" },
    ])
  })

  it("passes through existing Content-Type with boundary; backend will use it", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue(okResponse as any)

    const boundary = "PreSetBoundary123"
    const request = makeBase({
      headers: {
        ct: {
          id: "ct",
          name: "Content-Type",
          value: `multipart/form-data; boundary=${boundary}`,
          enabled: true,
          secure: false,
        },
      } as any,
    })

    await HttpEngine.execute({ request, response: {} } as any)
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    const ct = Object.entries(call.headers || {}).find(([k]) => k.toLowerCase() === "content-type")?.[1]
    expect(ct).toBe(`multipart/form-data; boundary=${boundary}`)
    expect(call.body).toBeUndefined()
    expect(call.multipartParts).toEqual([
      { type: "text", name: "field1", value: "value1" },
      { type: "text", name: "field2", value: "value2" },
    ])
  })

  it("delegates file parts to backend via multipartParts when filePath is present", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue(okResponse as any)

    const request = makeBase({
      body: {
        type: "form",
        encoding: "multipart",
        formData: {
          f: {
            id: "f",
            key: "upload",
            enabled: true,
            secure: false,
            kind: "file" as any,
            filePath: "/tmp/greeting.txt",
            fileName: "greeting.txt",
            contentType: "text/plain",
            value: "",
          } as any,
        },
      },
    })

    await HttpEngine.execute({ request, response: {} } as any)
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    expect(call.multipartParts).toBeTruthy()
    expect(call.body).toBeUndefined()
    expect(call.multipartParts[0]).toEqual({
      type: "file",
      name: "upload",
      filePath: "/tmp/greeting.txt",
      fileName: "greeting.txt",
      contentType: "text/plain",
    })
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: engine.binary.test.ts
// ---------------------------------------------------------------------------
describe("HttpEngine binary body", () => {
  beforeEach(() => vi.clearAllMocks())

  const base = (overrides: Partial<RequestState> = {}): RequestState => ({
    id: "req1",
    name: "Binary Test",
    collectionId: "col1",
    autoSave: false,
    method: "POST",
    url: "http://example.com/upload",
    pathParams: {},
    queryParams: {},
    headers: {},
    body: {
      type: "binary",
      binaryPath: "/tmp/blob.bin",
      binaryFileName: "blob.bin",
      binaryContentType: "application/octet-stream",
    },
    authentication: { type: "none" },
    tests: undefined,
    options: {},
    patch: {},
    updated: 0,
    ...(overrides as any),
  })

  const okResponse = {
    requestId: "rid",
    status: 200,
    statusText: "OK",
    headers: [],
    cookies: [],
    body: new Uint8Array(0),
    size: 0,
    duration: 1,
    timestamp: new Date().toISOString(),
  }

  it("passes bodyFilePath and sets Content-Type if provided", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue(okResponse as any)
    const request = base()
    await HttpEngine.execute({ request, response: {} } as any)
    expect(knurl.sendHttpRequest).toHaveBeenCalledOnce()
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    expect(call.bodyFilePath).toBe("/tmp/blob.bin")
    const ct = Object.entries(call.headers || {}).find(([k]) => k.toLowerCase() === "content-type")?.[1]
    expect(ct).toBe("application/octet-stream")
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: engine.auth-body.test.ts
// ---------------------------------------------------------------------------
describe("HttpEngine auth body placement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const okResponse = {
    requestId: "rid",
    status: 200,
    statusText: "OK",
    headers: [],
    cookies: [],
    body: new Uint8Array(0),
    size: 0,
    duration: 1,
    timestamp: new Date().toISOString(),
  }

  const makeFormUrl = (overrides: Partial<RequestState> = {}): RequestState => ({
    id: "req1",
    name: "Form URL",
    collectionId: "col1",
    autoSave: false,
    method: "POST",
    url: "http://example.com/form",
    pathParams: {},
    queryParams: {},
    headers: {},
    body: {
      type: "form",
      encoding: "url",
      formData: {
        a: { id: "a", key: "field1", value: "value1", enabled: true, secure: false },
      },
    },
    authentication: { type: "bearer", bearer: { placement: { type: "body", fieldName: "access_token" } } } as any,
    tests: undefined,
    options: {},
    patch: {},
    updated: 0,
    ...(overrides as any),
  })

  it("injects auth body fields into urlencoded form (last-wins)", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue(okResponse as any)
    const request = makeFormUrl()
    const authResult = { body: { access_token: "XYZ" } }

    await HttpEngine.execute({ request, response: {}, authResult } as any)
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    const bodyStr = new TextDecoder().decode(call.body)
    expect(bodyStr).toContain("field1=value1")
    expect(bodyStr).toContain("access_token=XYZ")
    const ct = Object.entries(call.headers || {}).find(([k]) => k.toLowerCase() === "content-type")?.[1]
    expect(ct).toBe("application/x-www-form-urlencoded")
  })

  it("adds auth fields as text parts in multipart (backend assembly)", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue(okResponse as any)
    const request: RequestState = {
      id: "req2",
      name: "Form MP",
      collectionId: "col1",
      autoSave: false,
      method: "POST",
      url: "http://example.com/upload",
      pathParams: {},
      queryParams: {},
      headers: {},
      body: {
        type: "form",
        encoding: "multipart",
        formData: {
          f: {
            id: "f",
            key: "file",
            enabled: true,
            secure: false,
            kind: "file",
            fileName: "a.txt",
            filePath: "/tmp/a.txt",
          } as any,
        },
      },
      authentication: {
        type: "apiKey",
        apiKey: { placement: { type: "body", fieldName: "api_key" }, value: "K" },
      } as any,
      tests: undefined,
      options: {},
      patch: {},
      updated: 0,
    }
    const authResult = { body: { api_key: "K" } }
    await HttpEngine.execute({ request, response: {}, authResult } as any)
    const call = vi.mocked(knurl.sendHttpRequest).mock.calls[0][0] as any
    expect(call.multipartParts).toBeTruthy()
    const textPart = call.multipartParts.find((p: any) => p.type === "text" && p.name === "api_key")
    expect(textPart).toBeTruthy()
    expect(textPart.value).toBe("K")
  })

  it("throws for auth body placement with text body", async () => {
    vi.mocked(knurl.sendHttpRequest).mockResolvedValue(okResponse as any)
    const request: RequestState = {
      id: "req3",
      name: "Text body",
      collectionId: "col1",
      autoSave: false,
      method: "POST",
      url: "http://example.com/echo",
      pathParams: {},
      queryParams: {},
      headers: {},
      body: { type: "text", language: "json", content: "{}" },
      authentication: { type: "bearer", bearer: { placement: { type: "body", fieldName: "token" } } } as any,
      tests: undefined,
      options: {},
      patch: {},
      updated: 0,
    }
    const authResult = { body: { token: "T" } }
    await expect(
      HttpEngine.execute({ request, response: {}, authResult } as any),
    ).rejects.toThrow(/Auth placement 'body'.*form bodies/i)
  })
})

// ---------------------------------------------------------------------------
// Comprehensive Error Model Coverage
// ---------------------------------------------------------------------------
describe("HttpEngine comprehensive error kinds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeBase = (overrides: Partial<RequestState> = {}): RequestState => ({
    id: "req1",
    name: "Error Test",
    collectionId: "col1",
    autoSave: false,
    method: "GET",
    url: "http://example.com",
    pathParams: {},
    queryParams: {},
    headers: {},
    body: { type: "none" },
    authentication: { type: "none" },
    tests: undefined,
    options: {},
    patch: {},
    updated: 0,
    ...(overrides as any),
  })

  it("propagates ConnectionRefused error from backend", async () => {
    const err: any = new Error("[ConnectionRefused] Connection refused by server")
    err.appError = {
      kind: "ConnectionRefused",
      message: "Connection refused by server",
      timestamp: new Date().toISOString(),
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any, "ConnectionRefused")).toBe(true)
      expect(e.appError.message).toMatch(/Connection refused/)
    }
  })

  it("propagates Timeout error from backend", async () => {
    const err: any = new Error("[Timeout] Request timed out after 30s")
    err.appError = {
      kind: "Timeout",
      message: "Request timed out after 30s",
      timestamp: new Date().toISOString(),
      context: { duration: "30000" },
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase({ url: "http://slow.example.com" }), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any, "Timeout")).toBe(true)
      expect(e.appError.context?.duration).toBe("30000")
    }
  })

  it("propagates HttpError with status code context", async () => {
    const err: any = new Error("[HttpError] HTTP 502 Bad Gateway")
    err.appError = {
      kind: "HttpError",
      message: "HTTP 502 Bad Gateway",
      timestamp: new Date().toISOString(),
      context: { statusCode: "502", reason: "Service temporarily unavailable" },
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any, "HttpError")).toBe(true)
      expect(e.appError.context?.statusCode).toBe("502")
    }
  })

  it("propagates DecryptionFailed error (crypto layer)", async () => {
    const err: any = new Error("[DecryptionFailed] AES-GCM tag verification failed")
    err.appError = {
      kind: "DecryptionFailed",
      message: "AES-GCM tag verification failed",
      timestamp: new Date().toISOString(),
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any, "DecryptionFailed")).toBe(true)
    }
  })

  it("propagates InvalidKeyLength error (crypto configuration)", async () => {
    const err: any = new Error("[InvalidKeyLength] Key must be 32 bytes for AES-256")
    err.appError = {
      kind: "InvalidKeyLength",
      message: "Key must be 32 bytes for AES-256",
      timestamp: new Date().toISOString(),
      context: { expected: "32", got: "16" },
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any, "InvalidKeyLength")).toBe(true)
      expect(e.appError.context?.expected).toBe("32")
    }
  })

  it("propagates PermissionDenied error for file/resource access", async () => {
    const err: any = new Error("[PermissionDenied] Access denied to file")
    err.appError = {
      kind: "PermissionDenied",
      message: "Access denied to file /root/.ssh/id_rsa",
      timestamp: new Date().toISOString(),
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any, "PermissionDenied")).toBe(true)
    }
  })

  it("propagates IoError from file system operations", async () => {
    const err: any = new Error("[IoError] Disk I/O error")
    err.appError = {
      kind: "IoError",
      message: "Failed to read from disk",
      timestamp: new Date().toISOString(),
      trace: { source: "std::fs::read", cause: "Permission denied" },
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any, "IoError")).toBe(true)
      expect(e.appError.trace?.source).toBe("std::fs::read")
    }
  })

  it("preserves error context and trace information", async () => {
    const err: any = new Error("[BadRequest] Invalid UTF-8 in query parameter")
    err.appError = {
      kind: "BadRequest",
      message: "Invalid UTF-8 sequence in query parameter 'q'",
      timestamp: new Date().toISOString(),
      context: { parameter: "q", value: "<invalid>" },
      trace: {
        source: "hyper_engine.rs",
        cause: "UTF-8 validation failed",
        location: "line 456",
      },
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(err)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(isAppError(e as any)).toBe(true)
      expect(e.appError.context?.parameter).toBe("q")
      expect(e.appError.trace?.source).toBe("hyper_engine.rs")
      expect(e.appError.trace?.location).toBe("line 456")
    }
  })

  it("isAppError guard works with error kind predicates", async () => {
    const connectionErr: any = new Error("[ConnectionRefused] Conn refused")
    connectionErr.appError = {
      kind: "ConnectionRefused",
      message: "Connection refused",
      timestamp: new Date().toISOString(),
    }
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(connectionErr)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
    } catch (e: any) {
      // Single kind check
      expect(isAppError(e, "ConnectionRefused")).toBe(true)
      expect(isAppError(e, "Timeout")).toBe(false)
      // Multiple kinds check (OR)
      expect(isAppError(e, ["Timeout", "ConnectionRefused"])).toBe(true)
      expect(isAppError(e, ["Timeout", "HttpError"])).toBe(false)
    }
  })

  it("non-AppError rejections are passed through", async () => {
    const plainErr = new Error("Generic network error")
    vi.mocked(knurl.sendHttpRequest).mockRejectedValue(plainErr)

    try {
      await HttpEngine.execute({ request: makeBase(), response: {} } as any)
      throw new Error("Expected to throw")
    } catch (e: any) {
      expect(e).toBe(plainErr)
      expect(isAppError(e)).toBe(false)
    }
  })
})
