import { describe, expect, it } from "vitest"
import { assert, generateUniqueId } from "./utils"

describe("assert", () => {
  it("should not throw for a truthy condition", () => {
    expect(() => assert(true, "This should not throw")).not.toThrow()
  })

  it("should throw an error for a falsy condition", () => {
    expect(() => assert(false, "Test Error")).toThrow("Test Error")
  })

  it("should throw a generic error if no message is provided", () => {
    expect(() => assert(false)).toThrow(Error)
  })
})

// ---------------------------------------------------------------------------
// Consolidated tests from: utils.more.test.ts
// ---------------------------------------------------------------------------
import {
  assertAbsent,
  assertPresent,
  cast,
  cn,
  isEmpty,
  isNotEmpty,
  mixin,
  nonNull,
  runTasks,
} from "./utils"

describe("utils helpers", () => {
  it("cn merges classes", () => {
    expect(cn("a", false && "b", "c")).toContain("a")
  })

  it("runTasks resolves values and aggregates errors", async () => {
    const ok = await runTasks<[number, string]>([Promise.resolve(1), Promise.resolve("a")])
    expect(ok).toEqual([1, "a"])
    await expect(runTasks([Promise.reject(new Error("x"))] as any)).rejects.toBeInstanceOf(AggregateError)
  })

  it("isEmpty/isNotEmpty detect object emptiness", () => {
    expect(isEmpty({})).toBe(true)
    expect(isNotEmpty({ a: 1 })).toBe(true)
  })

  it("nonNull returns value or throws", () => {
    expect(nonNull(1)).toBe(1)
    expect(() => nonNull(null as any, "err")).toThrow(/err/)
  })

  it("assert/assertPresent/assertAbsent narrow types", () => {
    expect(() => assert(false, "oops")).toThrow(/oops/)
    expect(() => assertPresent(null, "miss")).toThrow(/miss/)
    expect(() => assertAbsent(1, "nope")).toThrow(/nope/)
  })

  it("mixin composes prototype", () => {
    const base = { x: 1 }
    const mix = { y: 2 }
    const obj = mixin(base, mix)
    // @ts-expect-error y from mixin
    expect(obj.y).toBe(2)
  })

  it("generateUniqueId length and charset", () => {
    const id = generateUniqueId(16)
    expect(id).toHaveLength(16)
    expect(/^[A-Za-z0-9]+$/.test(id)).toBe(true)
  })

  it("cast coerces type without change", () => {
    const v = cast<number | string>("str")
    expect(typeof v).toBe("string")
  })
})

describe("generateUniqueId", () => {
  it("should generate an ID of the default length (12)", () => {
    const id = generateUniqueId()
    expect(id).toHaveLength(12)
  })

  it("should generate an ID of a specified length", () => {
    const id = generateUniqueId(8)
    expect(id).toHaveLength(8)
  })

  it("should only contain alphanumeric characters", () => {
    const id = generateUniqueId(24)
    expect(id).toMatch(/^[A-Za-z0-9]+$/)
  })

  it("should generate unique IDs on subsequent calls", () => {
    const id1 = generateUniqueId()
    const id2 = generateUniqueId()
    expect(id1).not.toEqual(id2)
  })
})
