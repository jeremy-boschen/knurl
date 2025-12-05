import { afterEach, describe, expect, it, vi } from "vitest"

const listeners: Array<(ev: MessageEvent<any>) => any> = []

function mockSelf() {
  // @ts-expect-error test shim
  globalThis.self = {
    addEventListener: (event: string, cb: any) => {
      if (event === "message") listeners.push(cb)
    },
    postMessage: vi.fn(),
  }
}

describe("prettier.worker", () => {
  afterEach(() => {
    listeners.length = 0
    // @ts-expect-error cleanup
    delete globalThis.self
    vi.resetModules()
  })

  const send = async (data: any) => {
    const handler = listeners[0]
    await handler?.({ data } as any)
    return (globalThis.self as any).postMessage
  }

  it("warms up plugins without formatting", async () => {
    mockSelf()
    await import("./prettier.worker")

    const post = await send({ type: "warmup", languages: ["json"] })
    expect(post).toHaveBeenCalledTimes(0)
  })

  it("formats json and posts result", async () => {
    mockSelf()
    await import("./prettier.worker")

    const post = await send({ id: 1, code: '{"a":1}', language: "json" })
    expect(post).toHaveBeenCalledTimes(1)
    const payload = post.mock.calls[0][0]
    expect(payload).toMatchObject({ id: 1, ok: true })
    expect(payload.formatted).toContain('"a": 1')
  })
})
