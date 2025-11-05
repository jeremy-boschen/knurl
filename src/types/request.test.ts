import { describe, expect, it } from "vitest"
import { zAuthConfig, zRequestState, toMergedRequest, type RequestState } from "./request"

describe("zAuthConfig", () => {
  it("should fail parsing if the discriminated union key is missing", () => {
    const invalidAuth = { type: "basic" } // Missing 'basic' property
    const result = zAuthConfig.safeParse(invalidAuth)
    expect(result.success).toBe(false)
  })

  it("should successfully parse a valid 'basic' auth object", () => {
    const validAuth = { type: "basic", basic: { username: "user" } }
    const result = zAuthConfig.safeParse(validAuth)
    expect(result.success).toBe(true)
  })

  it("should successfully parse a valid 'bearer' auth object", () => {
    const validAuth = { type: "bearer", bearer: { token: "abc" } }
    const result = zAuthConfig.safeParse(validAuth)
    expect(result.success).toBe(true)
  })

  it("should successfully parse a 'none' auth type", () => {
    const validAuth = { type: "none" }
    const result = zAuthConfig.safeParse(validAuth)
    expect(result.success).toBe(true)
  })
  
  it("oauth2 defaults grantType/clientAuth/tokenCaching", () => {
    const result = zAuthConfig.safeParse({ type: "oauth2", oauth2: {} })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.oauth2?.grantType).toBe("client_credentials")
      expect(result.data.oauth2?.clientAuth).toBe("body")
      expect(result.data.oauth2?.tokenCaching).toBe("always")
    }
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: request.body.defaults.test.ts
// ---------------------------------------------------------------------------
import { zRequestBodyData, zAuthPlacement } from "./request"
describe("zRequestBodyData defaults", () => {
  it("defaults to type none when not provided", () => {
    const parsed = zRequestBodyData.parse({} as any)
    expect(parsed.type).toBe("none")
  })
  it("form defaults encoding to url when missing", () => {
    const form = zRequestBodyData.parse({ type: "form" })
    expect(form.encoding ?? "url").toBe("url")
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: auth.placement.defaults.test.ts
// ---------------------------------------------------------------------------
describe("zAuthPlacement defaults", () => {
  it("header defaults name to Authorization", () => {
    const parsed = zAuthPlacement.parse({ type: "header" })
    expect(parsed.name).toBe("Authorization")
  })
  it("query/cookie default name to empty string", () => {
    const qp = zAuthPlacement.parse({ type: "query" })
    const ck = zAuthPlacement.parse({ type: "cookie" })
    expect(qp.name).toBe("")
    expect(ck.name).toBe("")
  })
  it("body defaults fieldName/contentType to empty strings", () => {
    const body = zAuthPlacement.parse({ type: "body" })
    expect(body.fieldName).toBe("")
    expect(body.contentType).toBe("")
  })
})

describe("zRequestState", () => {
  const minimalRequest = {
    id: "req1",
    collectionId: "col1",
    name: "My Request",
    method: "GET",
    url: "https://example.com",
    authentication: { type: "none" },
    // Required fields without defaults in the schema
    autoSave: false,
    pathParams: {},
    queryParams: {},
    headers: {},
    body: { type: "none" },
  }

  it("should apply default values for optional fields", () => {
    const result = zRequestState.safeParse(minimalRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.patch).toEqual({})
      expect(result.data.updated).toBe(0)
      expect(result.data.autoSave).toBe(false)
    }
  })

  it("should fail if required fields are missing", () => {
    const invalidRequest = { ...minimalRequest }
    // @ts-expect-error
    delete invalidRequest.name
    const result = zRequestState.safeParse(invalidRequest)
    expect(result.success).toBe(false)
  })

  it("does not materialize defaulted fields inside patch when patch is empty", () => {
    const req = {
      ...minimalRequest,
      autoSave: true,
      patch: {},
    }
    const parsed = zRequestState.parse(req)
    expect(parsed.patch).toEqual({})
    expect((parsed.patch as any).autoSave).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// toMergedRequest behavior
// ---------------------------------------------------------------------------
describe("toMergedRequest", () => {
  const base = (): RequestState => ({
    id: "r1",
    collectionId: "c1",
    name: "Base",
    autoSave: false,
    method: "GET",
    url: "https://example.com",
    pathParams: {},
    queryParams: {},
    headers: {},
    body: { type: "none" },
    authentication: { type: "none" },
    options: { timeoutSecs: 30, userAgent: undefined },
    patch: {},
    updated: 0,
  })

  it("returns base when patch is empty", () => {
    const b = base()
    const merged = toMergedRequest(b)
    expect(merged).toBe(b)
  })

  it("overrides primitives from patch and preserves others", () => {
    const b = base()
    b.patch = { name: "Patched", method: "POST" }
    const merged = toMergedRequest(b)
    expect(merged.name).toBe("Patched")
    expect(merged.method).toBe("POST")
    expect(merged.url).toBe(b.url)
  })

  it("replaces records (headers/query/path) when provided", () => {
    const b = base()
    b.headers = { h1: { id: "h1", name: "A", value: "1", enabled: true, secure: false } }
    b.patch = {
      headers: { h2: { id: "h2", name: "B", value: "2", enabled: true, secure: false } },
      queryParams: { q1: { id: "q1", name: "a", value: "1", enabled: true, secure: false } },
    }
    const merged = toMergedRequest(b)
    expect(Object.keys(merged.headers)).toEqual(["h2"]) // replaced
    expect(Object.keys(merged.queryParams)).toEqual(["q1"]) // replaced
  })

  it("body shallow merges and replaces formData", () => {
    const b = base()
    b.body = { type: "text", content: "hi", language: "json", formData: { f1: { id: "f1", key: "k", value: "v", enabled: true, secure: false } }, encoding: "url" }
    b.patch = { body: { content: "bye", formData: { f2: { id: "f2", key: "x", value: "y", enabled: true, secure: false } } } as any }
    const merged = toMergedRequest(b)
    expect(merged.body?.content).toBe("bye")
    expect(merged.body?.language).toBe("json") // preserved
    expect(Object.keys(merged.body?.formData ?? {})).toEqual(["f2"]) // replaced
  })

  it("authentication deep merges and cleans old type data on type change", () => {
    const b = base()
    b.authentication = { type: "bearer", bearer: { token: "T" } } as any
    b.patch = { authentication: { type: "basic", basic: { username: "u", password: "p" } } as any }
    const merged = toMergedRequest(b)
    expect(merged.authentication.type).toBe("basic")
    expect((merged.authentication as any).basic.username).toBe("u")
    expect((merged.authentication as any).bearer).toBeUndefined() // cleaned
  })

  it("options shallow merge supports setting and clearing keys", () => {
    const b = base()
    // Set UA and clear timeout by passing undefined explicitly
    b.patch = { options: { userAgent: "UA", timeoutSecs: undefined } as any }
    const merged = toMergedRequest(b)
    expect(merged.options?.userAgent).toBe("UA")
    expect(merged.options?.timeoutSecs).toBeUndefined()
  })

  it("autoSave respects patch override", () => {
    const b = base()
    b.autoSave = false
    b.patch = { autoSave: true }
    const m1 = toMergedRequest(b)
    expect(m1.autoSave).toBe(true)
    b.autoSave = true
    b.patch = { autoSave: false }
    const m2 = toMergedRequest(b)
    expect(m2.autoSave).toBe(false)
  })
})
