import { describe, expect, it, vi } from "vitest"

import { HttpEngine } from "./engine"

vi.mock("@/lib/request/prepared-http", () => ({
  prepareHttpRequest: vi.fn(() => ({
    url: "https://example.com",
    method: "POST",
    headers: [["Content-Type", "text/plain"]],
    body: { mode: "text", value: "hello" },
    options: { followRedirects: true },
  })),
}))

vi.mock("@/bindings/knurl", () => ({
  sendHttpRequest: vi.fn(async () => ({
    requestId: "req-1",
    status: 200,
    statusText: "OK",
    headers: [["Content-Type", "image/png"]],
    body: new Uint8Array([0, 1, 2]),
    cookies: [{ name: "c", value: "v", expires: Date.now() }],
    duration: 10,
    size: 3,
    timestamp: Date.now(),
  })),
}))

vi.mock("@/state/application", () => ({
  useApplication: {
    getState: () => ({
      settingsState: { requests: { previewMaxBytes: 10 } },
    }),
  },
}))

describe("HttpEngine", () => {
  it("encodes text bodies and parses binary previews", async () => {
    const context = { request: { id: "r1" }, response: {}, correlationId: "cid", authResult: undefined } as any
    const result = await HttpEngine.execute(context)

    expect(result.data.data.bodyBase64).toBeDefined()
    expect(result.data.data.cookies[0].expires).toMatch(/T/)
    expect(result.responseTime).toBe(10)
  })

  it("falls back when content-type is non-binary and timestamp invalid", async () => {
    vi.mocked(await import("@/bindings/knurl")).sendHttpRequest.mockResolvedValueOnce({
      requestId: "req-2",
      status: 204,
      statusText: "No Content",
      headers: [["Content-Type", "text/plain"]],
      body: undefined,
      cookies: [],
      duration: 5,
      size: 0,
      timestamp: "not-a-date",
    } as any)

    const result = await HttpEngine.execute({ request: { id: "r2" }, response: {} } as any)
    expect(result.data.data.bodyBase64).toBeUndefined()
    expect(result.timestamp).toBe("not-a-date")
  })
})
