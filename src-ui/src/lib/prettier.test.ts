import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"

const workerInstances: MockWorker[] = []
const workerMessages: Array<{instance: MockWorker; payload: any}> = []

class MockWorker {
  public onmessage: ((event: MessageEvent<any>) => void) | null = null
  public onerror: (() => void) | null = null

  constructor() {
    workerInstances.push(this)
  }

  // biome-ignore lint/suspicious/noExplicitAny: tests control payloads
  postMessage(payload: any) {
    workerMessages.push({instance: this, payload})
  }
}

vi.mock("../worker/prettier.worker.ts?worker", () => ({
  default: MockWorker,
}))

describe("formatWithPrettier", () => {
  beforeEach(() => {
    workerInstances.length = 0
    workerMessages.length = 0
    vi.resetModules()
  })

  afterEach(() => {
    globalThis.Worker = originalWorker
  })

  it("falls back when Worker API is unavailable", async () => {
    // @ts-expect-error simulate missing Worker
    globalThis.Worker = undefined
    const {formatWithPrettier} = await import("./prettier")
    const code = "{ \"a\": 1 }"
    const result = await formatWithPrettier(code, "json")
    expect(result).toBe(code)
    expect(workerInstances).toHaveLength(0)
  })

  it("formats using worker response", async () => {
    globalThis.Worker = class {} as typeof Worker
    const {formatWithPrettier, warmPrettier} = await import("./prettier")

    warmPrettier(["json"])
    expect(workerMessages[0]?.payload).toEqual({type: "warmup", languages: ["json"]})

    const formatted = formatWithPrettier("{\"b\":2}", "json")
    const message = workerMessages.find((m) => "id" in m.payload)
    expect(message).toBeDefined()
    message!.instance.onmessage?.({
      data: {id: message!.payload.id, ok: true, formatted: "{\n  \"b\": 2\n}"},
    } as MessageEvent)

    await expect(formatted).resolves.toBe("{\n  \"b\": 2\n}")
  })

  it("returns original code when worker errors", async () => {
    globalThis.Worker = class {} as typeof Worker
    const {formatWithPrettier} = await import("./prettier")

    const original = "body"
    const pending = formatWithPrettier(original, "json")
    const message = workerMessages.find((m) => "id" in m.payload)
    expect(message).toBeDefined()
    message!.instance.onerror?.()

    await expect(pending).resolves.toBe(original)

    const fallback = await formatWithPrettier("next", "json")
    expect(fallback).toBe("next")
  })
})
const originalWorker = globalThis.Worker
