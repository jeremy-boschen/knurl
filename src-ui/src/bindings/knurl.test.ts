import { describe, expect, it, vi, beforeEach } from "vitest"

import {
  cancelHttpRequest,
  deleteFile,
  getAppDataDir,
  sendHttpRequest,
  setDataEncryptionKey,
  discoverOidc,
} from "./knurl"

const invokeMock = vi.fn()

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

beforeEach(() => {
  invokeMock.mockReset()
})

describe("bindings/knurl", () => {
  it("forwards request options when sending HTTP requests", async () => {
    const response = { status: 201, statusText: "Created" }
    invokeMock.mockResolvedValue(response)

    const opts = {
      requestId: "req-1",
      url: "https://api.knurl.test/resource",
      method: "POST",
      headers: { Accept: "application/json" },
      body: new Uint8Array([1, 2, 3]),
      disableSsl: undefined,
      caPath: undefined,
      hostOverride: undefined,
      ipOverride: undefined,
      timeoutSecs: undefined,
      userAgent: undefined,
      httpVersion: "auto" as const,
      maxLogBytes: undefined,
      redactSensitive: undefined,
      logBodies: undefined,
      multipartParts: undefined,
      bodyFilePath: undefined,
      maxRedirects: undefined,
      previewMaxBytes: undefined,
    }

    const result = await sendHttpRequest(opts)

    expect(invokeMock).toHaveBeenCalledWith("send_http_request", { opts })
    expect(result).toBe(response)
  })

  it("maps parameter names for auth discovery and cancel", async () => {
    invokeMock.mockResolvedValueOnce({ authorizationEndpoint: "https://auth" })
    await discoverOidc("https://issuer/.well-known/openid-configuration")
    expect(invokeMock).toHaveBeenLastCalledWith("discover_oidc", {
      url: "https://issuer/.well-known/openid-configuration",
    })

    invokeMock.mockResolvedValueOnce(undefined)
    await cancelHttpRequest("req-123")
    expect(invokeMock).toHaveBeenLastCalledWith("cancel_http_request", {
      requestId: "req-123",
    })
  })

  it("normalizes app errors returned from invoke", async () => {
    const appError = {
      kind: "BadRequest" as const,
      message: "nope",
      timestamp: "2025-01-01T00:00:00.000Z",
      trace: { cause: "boom", source: "cmd", location: "lib.rs:10" },
      context: { foo: "bar" },
    }
    invokeMock.mockRejectedValue({ appError })

    await expect(getAppDataDir()).rejects.toThrow("[BadRequest] nope")
    try {
      await getAppDataDir()
    } catch (err) {
      const e = err as Error & { appError?: typeof appError }
      expect(e.appError).toEqual(appError)
      expect(e.message).toContain("cause: boom")
      expect(e.message).toContain("context: {\"foo\":\"bar\"}")
    }
  })

  it("passes payloads for encryption key and ignores delete errors", async () => {
    invokeMock.mockResolvedValueOnce(undefined)
    await setDataEncryptionKey("abc123")
    expect(invokeMock).toHaveBeenCalledWith("set_data_encryption_key", { keyB64: "abc123" })

    // deleteFile is best-effort and should swallow failures
    invokeMock.mockRejectedValueOnce(new Error("nope"))
    await expect(deleteFile("/tmp/missing.txt")).resolves.toBeUndefined()
  })

  it("wraps common app data operations", async () => {
    invokeMock.mockResolvedValueOnce({ foo: "bar" })
    const loaded = await (await import("./knurl")).loadAppData("file.json")
    expect(loaded).toEqual({ foo: "bar" })
    expect(invokeMock).toHaveBeenLastCalledWith("load_app_data", { fileName: "file.json" })

    invokeMock.mockResolvedValueOnce(undefined)
    await (await import("./knurl")).saveAppData("file.json", { a: 1 })
    expect(invokeMock).toHaveBeenLastCalledWith("save_app_data", { fileName: "file.json", data: { a: 1 } })

    invokeMock.mockResolvedValueOnce("/tmp/output.txt")
    await (await import("./knurl")).saveBinary("YmFzZTY0", { title: "Save", defaultPath: "out.bin", filters: [] })
    expect(invokeMock).toHaveBeenLastCalledWith("save_binary", {
      contentBase64: "YmFzZTY0",
      options: { title: "Save", defaultPath: "out.bin", filters: [] },
    })

    invokeMock.mockResolvedValueOnce(null)
    const opened = await (await import("./knurl")).openFile({ title: "Pick", filters: [], defaultPath: undefined, readContent: true })
    expect(opened).toBeNull()
    expect(invokeMock).toHaveBeenLastCalledWith("open_file", {
      options: { title: "Pick", filters: [], defaultPath: undefined, readContent: true },
    })
  })

  it("handles remaining bindings happy paths", async () => {
    invokeMock.mockResolvedValueOnce("key-123")
    const key = await (await import("./knurl")).getDataEncryptionKey()
    expect(key).toBe("key-123")
    expect(invokeMock).toHaveBeenLastCalledWith("get_data_encryption_key")

    invokeMock.mockResolvedValueOnce("/tmp/file.txt")
    await (await import("./knurl")).saveFile("hello", { title: "Title", defaultPath: "file.txt", filters: [] })
    expect(invokeMock).toHaveBeenLastCalledWith("save_file", {
      content: "hello",
      options: { title: "Title", defaultPath: "file.txt", filters: [] },
    })

    invokeMock.mockResolvedValueOnce(undefined)
    await (await import("./knurl")).deleteAppData("data.json")
    expect(invokeMock).toHaveBeenLastCalledWith("delete_app_data", { fileName: "data.json" })
  })

  it("passes parent request id through getAuthenticationResult", async () => {
    invokeMock.mockResolvedValueOnce({ headers: { Authorization: "Bearer ok" } })
    const config = { type: "bearer", token: "ok" }
    const result = await (await import("./knurl")).getAuthenticationResult(config, "parent-1")
    expect(result).toEqual({ headers: { Authorization: "Bearer ok" } })
    expect(invokeMock).toHaveBeenLastCalledWith("get_authentication_result", {
      config,
      parent_request_id: "parent-1",
    })
  })
})
