import { describe, expect, it } from "vitest"

import { prepareHttpRequest } from "@/lib/request/prepared-http"
import type { AuthResult, RequestState } from "@/types"

const baseRequest = (): RequestState => ({
  id: "req-1",
  folderId: "root",
  order: 0,
  name: "Example",
  collectionId: "col-1",
  environmentId: undefined,
  autoSave: false,
  method: "POST",
  url: "https://api.example.com/users?debug=true",
  pathParams: {},
  queryParams: {},
  headers: {},
  cookieParams: {},
  body: {
    type: "text",
    content: '{"name":"alice"}',
    language: "json",
  },
  authentication: { type: "none" },
  tests: undefined,
  options: {},
  patch: {},
  updated: new Date().toISOString(),
})

describe("prepareHttpRequest", () => {
  it("builds headers and body for plain text payloads", () => {
    const prepared = prepareHttpRequest({ request: baseRequest() })

    expect(prepared.method).toBe("POST")
    expect(prepared.url).toBe("https://api.example.com/users?debug=true")
    expect(prepared.headers["Content-Type"]).toBe("application/json")
    expect(prepared.body.mode).toBe("text")
    if (prepared.body.mode === "text") {
      expect(prepared.body.value).toBe('{"name":"alice"}')
    }
  })

  it("merges auth headers without overwriting existing values", () => {
    const request = baseRequest()
    request.headers = {
      header1: {
        id: "h1",
        name: "Accept",
        value: "application/json",
        enabled: true,
        secure: false,
      },
    }
    const authResult: AuthResult = {
      headers: { Authorization: "Bearer token-123" },
    }

    const prepared = prepareHttpRequest({ request, authResult })
    expect(prepared.headers.Accept).toBe("application/json")
    expect(prepared.headers.Authorization).toBe("Bearer token-123")
  })

  it("normalizes request options for downstream consumers", () => {
    const request = baseRequest()
    request.options = {
      disableSsl: true,
      caPath: "   ",
      hostOverride: "api.internal.local ",
      ipOverride: " 10.0.0.5",
      timeoutSecs: " 15 ",
      userAgent: "  Knurl/1.0 ",
      httpVersion: "http2",
      maxRedirects: 0,
    }

    const prepared = prepareHttpRequest({ request })

    expect(prepared.options.disableSsl).toBe(true)
    expect(prepared.options.caPath).toBeUndefined()
    expect(prepared.options.hostOverride).toBe("api.internal.local")
    expect(prepared.options.ipOverride).toBe("10.0.0.5")
    expect(prepared.options.timeoutSecs).toBe(15)
    expect(prepared.options.userAgent).toBe("Knurl/1.0")
    expect(prepared.options.httpVersion).toBe("http2")
    expect(prepared.options.maxRedirects).toBe(0)
  })

  it("extracts ip override from combined DNS override string", () => {
    const request = baseRequest()
    request.options = {
      hostOverride: "api.example.com:8443:127.0.0.11",
    }

    const prepared = prepareHttpRequest({ request })

    expect(prepared.options.hostOverride).toBe("api.example.com:8443")
    expect(prepared.options.ipOverride).toBe("127.0.0.11")
  })

  it("injects auth query params and cookies", () => {
    const request = baseRequest()
    request.method = "GET"
    request.body = { type: "none" }
    const authResult: AuthResult = {
      query: { api_key: "secret" },
      cookies: { session: "abc123" },
    }

    const prepared = prepareHttpRequest({ request, authResult })
    expect(prepared.url).toContain("api_key=secret")
    const cookieHeader = prepared.headers.Cookie ?? prepared.headers.cookie
    expect(cookieHeader).toContain("session=abc123")
    expect(prepared.body.mode).toBe("none")
  })

  it("replaces path params and builds fallback URLs without scheme", () => {
    const request = baseRequest()
    request.url = "/users/{{userId}}"
    request.queryParams = {
      q1: { id: "q1", name: "search", value: "admin", enabled: true, secure: false } as any,
    }
    request.pathParams = {
      p1: { id: "p1", name: "userId", value: "42", enabled: true, secure: false } as any,
    }

    const prepared = prepareHttpRequest({ request })
    expect(prepared.url).toBe("/users/42?search=admin")
  })

  it("throws when auth body targets text payloads", () => {
    const request = baseRequest()
    const authResult: AuthResult = { body: { token: "abc" } }
    expect(() => prepareHttpRequest({ request, authResult })).toThrow(/Auth placement 'body'/)
  })

  it("builds urlencoded form bodies and merges auth body entries", () => {
    const request = baseRequest()
    request.body = {
      type: "form",
      encoding: "url",
      formData: {
        f1: { id: "f1", key: "first", value: "alpha", enabled: true, secure: false } as any,
        f2: { id: "f2", key: "second", value: "beta", enabled: true, secure: false } as any,
      },
    }
    const authResult: AuthResult = {
      body: { token: "abc123" },
    }

    const prepared = prepareHttpRequest({ request, authResult })
    expect(prepared.headers["Content-Type"]).toBe("application/x-www-form-urlencoded")
    expect(prepared.body.mode).toBe("urlencoded")
    if (prepared.body.mode === "urlencoded") {
      expect(prepared.body.value).toContain("first=alpha")
      expect(prepared.body.value).toContain("second=beta")
      expect(prepared.body.value).toContain("token=abc123")
    }
  })

  it("throws when form file fields are used with URL encoding", () => {
    const request = baseRequest()
    request.body = {
      type: "form",
      encoding: "url",
      formData: {
        f1: {
          id: "f1",
          key: "file",
          value: "ignored",
          enabled: true,
          secure: false,
          kind: "file",
          filePath: "/tmp/data.txt",
        } as any,
      },
    }

    expect(() => prepareHttpRequest({ request })).toThrow(/application\/x-www-form-urlencoded/)
  })

  it("builds multipart form data merging auth entries", () => {
    const request = baseRequest()
    request.body = {
      type: "form",
      encoding: "multipart",
      formData: {
        text: { id: "t1", key: "message", value: "hello", enabled: true, secure: false } as any,
        file: {
          id: "f1",
          key: "attachment",
          value: "ignored",
          enabled: true,
          secure: false,
          kind: "file",
          filePath: "/tmp/file.bin",
          fileName: "file.bin",
          contentType: "application/octet-stream",
        } as any,
      },
    }
    const authResult: AuthResult = {
      body: { extra: "value" },
    }

    const prepared = prepareHttpRequest({ request, authResult })
    expect(prepared.body.mode).toBe("multipart")
    if (prepared.body.mode === "multipart") {
      expect(prepared.body.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "file", name: "attachment", filePath: "/tmp/file.bin" }),
          expect.objectContaining({ type: "text", name: "extra", value: "value" }),
        ]),
      )
    }
  })

  it("returns binary body and sets explicit content type", () => {
    const request = baseRequest()
    request.body = {
      type: "binary",
      binaryPath: "/tmp/image.png",
      binaryContentType: "image/png",
    }

    const prepared = prepareHttpRequest({ request })
    expect(prepared.body.mode).toBe("binary")
    if (prepared.body.mode === "binary") {
      expect(prepared.body.filePath).toBe("/tmp/image.png")
    }
    expect(prepared.headers["Content-Type"]).toBe("image/png")
  })

  it("combines cookie params with existing and auth cookies", () => {
    const request = baseRequest()
    request.headers = {
      h1: { id: "h1", name: "Cookie", value: "theme=dark", enabled: true, secure: false } as any,
    }
    request.cookieParams = {
      c1: { id: "c1", name: "session", value: "abc123", enabled: true, secure: false } as any,
    }
    const authResult: AuthResult = {
      cookies: { locale: "en-US" },
    }

    const prepared = prepareHttpRequest({ request, authResult })
    const header = prepared.headers.Cookie ?? prepared.headers.cookie
    expect(header).toContain("session=abc123")
    expect(header).toContain("locale=en-US")
    expect(header.startsWith("session=abc123")).toBe(true)
  })

  it("throws when absolute URL lacks host", () => {
    const request = baseRequest()
    request.url = "https://?missing=host"
    expect(() => prepareHttpRequest({ request })).toThrow(/Invalid URL/)
  })
})
