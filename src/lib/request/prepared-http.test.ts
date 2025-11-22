import { describe, expect, it } from "vitest"

import { prepareHttpRequest } from "./prepared-http"
import { createRequestFixture } from "@/test/fixtures/collections"
import type { AuthResult } from "@/types"

describe("prepareHttpRequest", () => {
  it("builds url with path params, query params, and auth query overrides", () => {
    const request = createRequestFixture({
      method: "POST",
      url: "https://api.knurl.dev/users/{{userId}}",
    })

    request.pathParams = {
      user: { id: "user", name: "userId", value: "42", enabled: true, secure: false },
    }
    request.queryParams = {
      search: { id: "search", name: "q", value: "knurl", enabled: true, secure: false },
    }

    const authResult: AuthResult = {
      query: { token: "abc123" },
    }

    const prepared = prepareHttpRequest({ request, authResult })

    expect(prepared.url).toBe("https://api.knurl.dev/users/42?q=knurl&token=abc123")
    expect(prepared.method).toBe("POST")
  })

  it("preserves existing auth headers and merges auth cookies", () => {
    const request = createRequestFixture({
      method: "GET",
      url: "https://api.knurl.dev/profile",
    })

    request.headers = {
      authorization: { id: "auth", name: "Authorization", value: "Bearer existing", enabled: true, secure: false },
      cookie: { id: "cookie", name: "Cookie", value: "theme=dark", enabled: true, secure: false },
    }

    const prepared = prepareHttpRequest({
      request,
      authResult: {
        headers: { authorization: "Bearer injected" },
        cookies: { session: "abc" },
      },
    })

    expect(prepared.headers.Authorization).toBe("Bearer existing")
    expect(prepared.headers.Cookie).toContain("theme=dark")
    expect(prepared.headers.Cookie).toContain("session=abc")
  })

  it("falls back to manual URL building and appends auth/query params", () => {
    const request = createRequestFixture({ method: "GET", url: "api.knurl.dev/search" })
    request.queryParams = {
      q: { id: "q", name: "q", value: "knurl", enabled: true, secure: false },
    }

    const prepared = prepareHttpRequest({
      request,
      authResult: { query: { token: "t1" } },
    })

    expect(prepared.url).toBe("api.knurl.dev/search?q=knurl&token=t1")
  })

  it("throws on schemed URLs without a host", () => {
    const request = createRequestFixture({ method: "GET", url: "http:///" })
    expect(() => prepareHttpRequest({ request, authResult: undefined })).toThrow(/host is missing/i)
  })

  it("merges headers, cookies, and text body content", () => {
    const request = createRequestFixture({ method: "POST" })
    request.headers = {
      accept: { id: "accept", name: "Accept", value: "application/json", enabled: true, secure: false },
      disabled: { id: "disabled", name: "X-Off", value: "nope", enabled: false, secure: false },
    }
    request.cookieParams = {
      session: { id: "session", name: "session", value: "s1", enabled: true, secure: false },
      theme: { id: "theme", name: "theme", value: "dark", enabled: true, secure: false },
    }
    request.body = {
      type: "text",
      language: "json",
      content: '{"ok":true}',
    }

    const authResult: AuthResult = {
      headers: { Authorization: "Bearer token" },
      cookies: { auth: "cookie" },
    }

    const prepared = prepareHttpRequest({ request, authResult })

    expect(prepared.body).toEqual({ mode: "text", value: '{"ok":true}' })
    expect(prepared.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    })
    expect(prepared.headers.Cookie).toContain("session=s1")
    expect(prepared.headers.Cookie).toContain("auth=cookie")
    expect(prepared.headers).not.toHaveProperty("X-Off")
  })

  it("throws when auth body placement is used with text payloads", () => {
    const request = createRequestFixture({ method: "POST" })
    request.body = { type: "text", content: "body" }

    expect(() =>
      prepareHttpRequest({
        request,
        authResult: { body: { token: "abc" } },
      }),
    ).toThrow(/Auth placement 'body'/)
  })

  it("builds multipart bodies and appends auth body parameters", () => {
    const request = createRequestFixture({ method: "POST" })
    request.body = {
      type: "form",
      encoding: "multipart",
      formData: {
        textField: { id: "text", key: "title", value: "Knurl", enabled: true, secure: false, kind: "text" },
        fileField: {
          id: "file",
          key: "upload",
          kind: "file",
          enabled: true,
          secure: false,
          filePath: "/tmp/file.bin",
          fileName: "file.bin",
          contentType: "application/octet-stream",
        },
      },
    }

    const prepared = prepareHttpRequest({
      request,
      authResult: { body: { token: "xyz" } },
    })

    expect(prepared.body.mode).toBe("multipart")
    if (prepared.body.mode === "multipart") {
      expect(prepared.body.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text", name: "title", value: "Knurl" }),
          expect.objectContaining({ type: "file", name: "upload", filePath: "/tmp/file.bin" }),
          expect.objectContaining({ type: "text", name: "token", value: "xyz" }),
        ]),
      )
    }
  })

  it("returns binary mode and builds options from overrides", () => {
    const request = createRequestFixture({
      method: "POST",
      body: { type: "binary", binaryPath: "/tmp/payload.bin", binaryContentType: "application/octet-stream" } as any,
    })

    request.options = {
      disableSsl: true,
      caPath: " /tmp/ca.pem ",
      hostOverride: "api.knurl.dev:8443@10.0.0.5",
      timeoutSecs: "45" as any,
      userAgent: " KnurlClient/1.0 ",
      maxRedirects: 5,
      maxLogBytes: "2048" as any,
      redactSensitive: 1 as any,
      logBodies: 0 as any,
    }

    const prepared = prepareHttpRequest({ request, authResult: undefined })

    expect(prepared.body).toEqual({ mode: "binary", filePath: "/tmp/payload.bin" })
    expect(prepared.headers["Content-Type"]).toBe("application/octet-stream")
    expect(prepared.options).toMatchObject({
      disableSsl: true,
      caPath: "/tmp/ca.pem",
      hostOverride: "api.knurl.dev:8443@10.0.0.5",
      timeoutSecs: 45,
      userAgent: "KnurlClient/1.0",
      maxRedirects: 5,
      maxLogBytes: 2048,
      redactSensitive: true,
      logBodies: false,
    })
  })
})
