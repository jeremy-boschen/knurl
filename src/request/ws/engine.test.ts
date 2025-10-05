import { describe, it, expect } from "vitest"
import { WebSocketEngine } from "./engine"

describe("WebSocketEngine", () => {
  it("returns a mock connected response", async () => {
    const ctx: any = { request: { url: "wss://example.com", method: "GET" }, response: {} }
    const res = await WebSocketEngine.execute(ctx)
    expect(res.data?.type).toBe("websocket")
    expect(res.data?.data?.status).toBe("Connected")
    expect(typeof res.timestamp).toBe("string")
  })
})

