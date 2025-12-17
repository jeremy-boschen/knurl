import { describe, expect, it, vi } from "vitest"

const loggerMock = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() }))
vi.mock("@/lib/logger", () => ({ getSyncLogger: () => loggerMock }))

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

  it("logs warning when timestamp cannot be parsed", async () => {
    loggerMock.warn.mockClear()
    vi.mocked(await import("@/bindings/knurl")).sendHttpRequest.mockResolvedValueOnce({
      requestId: "req-3",
      status: 200,
      statusText: "OK",
      headers: [["Content-Type", "text/plain"]],
      body: undefined,
      cookies: [],
      duration: 5,
      size: 0,
      timestamp: "invalid-timestamp",
    } as any)

    await HttpEngine.execute({ request: { id: "r3" }, response: {} } as any)
    expect(loggerMock.warn).toHaveBeenCalled()
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.stringContaining("[HTTP_ENGINE]"),
    )
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse response timestamp"),
    )
  })

  it("logs warning when cookie expiry date cannot be parsed", async () => {
    loggerMock.warn.mockClear()
    vi.mocked(await import("@/bindings/knurl")).sendHttpRequest.mockResolvedValueOnce({
      requestId: "req-4",
      status: 200,
      statusText: "OK",
      headers: [["Content-Type", "text/plain"]],
      body: undefined,
      cookies: [{ name: "test", value: "val", expires: "invalid-expires" }],
      duration: 5,
      size: 0,
      timestamp: Date.now(),
    } as any)

    await HttpEngine.execute({ request: { id: "r4" }, response: {} } as any)
    expect(loggerMock.warn).toHaveBeenCalled()
    const warnCalls = loggerMock.warn.mock.calls.filter((call) =>
      call[0].includes("Failed to parse cookie expiry"),
    )
    expect(warnCalls.length).toBeGreaterThan(0)
  })

  it("logs error when response validation fails", async () => {
    loggerMock.error.mockClear()
    // Mock sendHttpRequest to return invalid data that will fail Zod validation
    vi.mocked(await import("@/bindings/knurl")).sendHttpRequest.mockResolvedValueOnce({
      requestId: 123, // Invalid: should be string
      status: "invalid", // Invalid: should be number
      statusText: "OK",
      headers: [["Content-Type", "text/plain"]],
      body: undefined,
      cookies: [],
      duration: 5,
      size: 0,
      timestamp: Date.now(),
    } as any)

    await expect(HttpEngine.execute({ request: { id: "r5" }, response: {} } as any)).rejects.toThrow()
    // Should have logged the parse error
    const errorCalls = loggerMock.error.mock.calls.filter((call) =>
      call[0].includes("[HTTP_ENGINE]"),
    )
    expect(errorCalls.length).toBeGreaterThan(0)
  })
})
