import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { asSuspense, zParse } from "./utils"

const createDeferred = <T>() => {
  let resolve: (value: T | PromiseLike<T>) => void
  let reject: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

describe("zParse", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  })

  it("should return parsed data for valid input", () => {
    const data = { name: "John", age: 30 }
    const result = zParse(schema, data)
    expect(result).toEqual(data)
  })

  it("should throw a Zod error for invalid input", () => {
    const data = { name: "John", age: "thirty" }
    expect(() => zParse(schema, data)).toThrow(z.ZodError)
  })

  it("should log an error to the console when parsing fails", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const data = { name: 123, age: 30 }

    expect(() => zParse(schema, data)).toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

describe("asSuspense", () => {
  it("throws the pending promise until resolved", async () => {
    const deferred = createDeferred<string>()
    const suspense = asSuspense(deferred.promise)

    let thrown: unknown
    try {
      suspense.read()
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Promise)

    deferred.resolve("ok")
    await deferred.promise

    expect(suspense.read()).toBe("ok")
  })

  it("throws the rejection error after the promise fails", async () => {
    const deferred = createDeferred<string>()
    const suspense = asSuspense(deferred.promise)
    const error = new Error("boom")

    let thrown: unknown
    try {
      suspense.read()
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Promise)

    deferred.reject(error)
    await deferred.promise.catch(() => {})

    let thrownAfter: unknown
    try {
      suspense.read()
    } catch (err) {
      thrownAfter = err
    }
    expect(thrownAfter).toBe(error)
  })
})
