import { describe, it, expect } from "vitest"
import { mockIPC } from "@tauri-apps/api/mocks"

import { isAppError, sendHttpRequest } from "./knurl"

// Minimal request payload respecting the Request class shape in bindings
const minimalRequest: any = {
  id: "req-1",
  method: "GET",
  url: "https://example.com",
  headers: {},
  body: new Uint8Array(0),
  flags: { maxLogBytes: 1024, redactSensitive: true, logBodies: true },
}

describe("bindings: error normalization and guards", () => {
  it("maps backend AppError to Error with .appError and isAppError detects it", async () => {
    // Arrange: mock invoke to reject with AppError-shaped object
    const appError = {
      kind: "BadRequest",
      message: "Invalid URL",
      timestamp: Date.now(),
      trace: { file: "hyper_engine.rs", line: 123, column: 42 },
    }

    mockIPC((cmd, payload) => {
      if (cmd === "send_http_request") {
        throw appError
      }
    })

    // Act+Assert
    try {
      await sendHttpRequest(minimalRequest)
      throw new Error("Expected sendHttpRequest to throw")
    } catch (e: any) {
      // isAppError should be true, and kind must match
      expect(isAppError(e)).toBe(true)
      expect(e).toBeInstanceOf(Error)
      expect(e.message).toMatch(/\[BadRequest\] Invalid URL/)
      // ensure structured error attached
      expect(e.appError.kind).toBe("BadRequest")
      expect(e.appError.message).toBe("Invalid URL")
    }
  })

  it("non-AppError rejections are rethrown as normal Error and isAppError is false", async () => {
    // Case 1: string rejection
    mockIPC((cmd) => {
      if (cmd === "send_http_request") {
        throw "boom"
      }
    })
    await expect(sendHttpRequest(minimalRequest)).rejects.toThrowError(/boom/)
    // Additionally validate guard
    await sendHttpRequest(minimalRequest).catch((e) => {
      expect(isAppError(e)).toBe(false)
    })

    // Case 2: Error instance rejection
    const err = new Error("network down")
    mockIPC((cmd) => {
      if (cmd === "send_http_request") {
        throw err
      }
    })
    try {
      await sendHttpRequest(minimalRequest)
      throw new Error("Expected throw")
    } catch (e: any) {
      expect(e).toBe(err)
      expect(isAppError(e)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: knurl.contracts.test.ts
// ---------------------------------------------------------------------------
describe("bindings contracts: sendHttpRequest Response shape", () => {
  it("passes through structured fields and ArrayBuffer body", async () => {
    const bodyBytes = new TextEncoder().encode("payload").buffer
    const now = new Date().toISOString()

    mockIPC((cmd, payload) => {
      if (cmd === "send_http_request") {
        const opts = (payload as any).opts
        expect(opts.url).toBeDefined()
        expect(["GET", "POST", "PUT", "DELETE", "HEAD", "PATCH"]).toContain(opts.method)

        return {
          requestId: opts.requestId ?? "id-1",
          status: 201,
          statusText: "Created",
          headers: [["X-Test", "1"], ["Content-Type", "application/json"]],
          cookies: [
            { name: "sid", value: "abc", domain: "example.com", path: "/", httpOnly: true, secure: true },
          ],
          body: bodyBytes,
          size: (bodyBytes as ArrayBuffer).byteLength,
          duration: 12,
          timestamp: now,
        }
      }
    })

    const res = await sendHttpRequest({
      requestId: "id-1",
      url: "https://example.com",
      method: "GET",
      headers: {},
    } as any)

    expect(res.status).toBe(201)
    expect(res.statusText).toBe("Created")
    expect(Array.isArray(res.headers)).toBe(true)
    expect(res.headers).toContainEqual(["X-Test", "1"])
    expect(res.cookies?.[0]?.name).toBe("sid")
    expect(typeof res.size).toBe("number")
    expect(res.size).toBe(7)
    expect(typeof res.timestamp).toBe("string")
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: knurl.appdata.contracts.test.ts
// ---------------------------------------------------------------------------
import { loadAppData, saveAppData, deleteAppData } from "./knurl"
describe("bindings contracts: app data commands", () => {
  it("loadAppData passes fileName and returns JSON; FileNotFound maps as AppError", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "load_app_data") {
        const { fileName } = payload as any
        expect(fileName).toBe("collections/.index.json")
        return { version: 1, index: {} }
      }
    })

    const data = await loadAppData("collections/.index.json")
    expect((data as any).version).toBe(1)

    const appError = { kind: "FileNotFound", message: "missing", timestamp: Date.now() }
    mockIPC((cmd) => {
      if (cmd === "load_app_data") { throw appError }
    })
    try {
      await loadAppData("missing.json")
      throw new Error("expected throw")
    } catch (e: any) {
      expect(isAppError(e)).toBe(true)
      expect(e.appError.kind).toBe("FileNotFound")
    }
  })

  it("saveAppData and deleteAppData pass fileName and payload", async () => {
    let saved: any = null
    mockIPC((cmd, payload) => {
      if (cmd === "save_app_data") {
        const { fileName, data } = payload as any
        expect(fileName).toBe("collections/c1.json")
        saved = data
        return null
      }
      if (cmd === "delete_app_data") {
        const { fileName } = payload as any
        expect(fileName).toBe("collections/c1.json")
        return null
      }
    })

    await saveAppData("collections/c1.json", { id: "c1", name: "C1" } as any)
    expect(saved.id).toBe("c1")
    await deleteAppData("collections/c1.json")
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: knurl.auth.contracts.test.ts and knurl.auth.config-shapes.test.ts
// ---------------------------------------------------------------------------
import { getAuthenticationResult } from "./knurl"
describe("bindings contracts: getAuthenticationResult", () => {
  it("returns mapped AuthResult and receives parent_request_id", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "get_authentication_result") {
        const { config, parent_request_id } = payload as any
        expect(parent_request_id).toBe("req-parent-1")
        expect(config.type).toBeDefined()
        return {
          headers: { Authorization: "Bearer TOKEN" },
          query: { q: "1" },
          cookies: { sid: "abc" },
          body: { extra: "x" },
          expiresAt: Date.now() + 3600_000,
        }
      }
    })

    const res = await getAuthenticationResult({ type: "bearer", token: "TOKEN", placement: { type: "header" } }, "req-parent-1")
    expect(res.headers?.Authorization).toBe("Bearer TOKEN")
    expect(res.query?.q).toBe("1")
    expect(res.cookies?.sid).toBe("abc")
    expect(res.body?.extra).toBe("x")
    expect(typeof res.expiresAt === "number" || typeof (res as any).expires_at === "number").toBe(true)
  })

  it("basic: sends username/password", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "get_authentication_result") {
        const { config } = payload as any
        expect(config.type).toBe("basic")
        expect(config.username).toBe("u")
        expect(config.password).toBe("p")
        return { headers: { Authorization: "Basic xxx" } }
      }
    })
    const res = await getAuthenticationResult({ type: "basic", username: "u", password: "p" })
    expect(res.headers?.Authorization).toBeDefined()
  })

  it("apiKey: sends key/value and placement", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "get_authentication_result") {
        const { config } = payload as any
        expect(config.type).toBe("apiKey")
        expect(config.key).toBe("X-API-Key")
        expect(config.value).toBe("secret")
        expect(config.placement?.type).toBe("header")
        return { headers: { "X-API-Key": "secret" } }
      }
    })
    const res = await getAuthenticationResult({ type: "apiKey", key: "X-API-Key", value: "secret", placement: { type: "header" } })
    expect(res.headers?.["X-API-Key"]).toBe("secret")
  })

  it("oauth2: client_credentials with clientAuth basic and body", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "get_authentication_result") {
        const { config } = payload as any
        expect(config.type).toBe("oauth2")
        expect(config.grantType).toBe("client_credentials")
        expect(["basic", "body"]).toContain(config.clientAuth)
        return { headers: { Authorization: "Bearer tok" }, expiresAt: Date.now() + 1000 }
      }
    })
    const res1 = await getAuthenticationResult({ type: "oauth2", grantType: "client_credentials", tokenUrl: "https://issuer/token", clientId: "id", clientSecret: "sec", scope: "a b", clientAuth: "basic" })
    expect(res1.headers?.Authorization).toMatch(/Bearer/)
    const res2 = await getAuthenticationResult({ type: "oauth2", grantType: "client_credentials", tokenUrl: "https://issuer/token", clientId: "id", clientSecret: "sec", scope: "a b", clientAuth: "body" })
    expect(res2.headers?.Authorization).toMatch(/Bearer/)
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: knurl.cancel-http.contracts.test.ts
// ---------------------------------------------------------------------------
import { cancelHttpRequest } from "./knurl"
describe("bindings contracts: cancelHttpRequest", () => {
  it("passes requestId to IPC", async () => {
    let seenId: string | undefined
    mockIPC((cmd, payload) => {
      if (cmd === "cancel_http_request") {
        const { requestId } = payload as any
        seenId = requestId
        return null
      }
    })

    await cancelHttpRequest("req-123")
    expect(seenId).toBe("req-123")
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: knurl.file-dialogs.contracts.test.ts
// ---------------------------------------------------------------------------
import { openFile, saveFile } from "./knurl"
describe("bindings contracts: file dialogs", () => {
  it("saveFile passes content and options and returns a path; UserCancelled maps to CommandError", async () => {
    const options = { title: "Save As", defaultPath: "C:/tmp/test.json", filters: [{ name: "JSON", extensions: ["json"] }] }

    // Success path
    mockIPC((cmd, payload) => {
      if (cmd === "save_file") {
        const { content, options: opts } = payload as any
        expect(content).toBe("{\"a\":1}")
        expect(opts.title).toBe(options.title)
        expect(opts.defaultPath).toBe(options.defaultPath)
        return "C:/tmp/test.json"
      }
    })
    const path = await saveFile("{\"a\":1}", options as any)
    expect(path).toBe("C:/tmp/test.json")

    // Cancellation error
    const appError = { kind: "UserCancelled", message: "cancel", timestamp: Date.now() }
    mockIPC((cmd) => {
      if (cmd === "save_file") { throw appError }
    })
    try {
      await saveFile("{}", options as any)
      throw new Error("expected throw")
    } catch (e: any) {
      expect(e).toBeInstanceOf(Error)
      expect(isAppError(e)).toBe(true)
      expect(e.appError.kind).toBe("UserCancelled")
    }
  })

  it("openFile passes options and respects readContent flag", async () => {
    const options = { title: "Open", readContent: false }

    mockIPC((cmd, payload) => {
      if (cmd === "open_file") {
        const { options: opts } = payload as any
        expect(opts.readContent).toBe(false)
        return { filePath: "C:/tmp/a.txt", content: "" }
      }
    })

    const res = await openFile(options as any)
    expect(res?.filePath).toBe("C:/tmp/a.txt")
    expect(res?.content).toBe("")
  })
})
