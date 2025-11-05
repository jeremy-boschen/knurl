import { describe, expect, it } from "vitest"
import { parseSize, toPercentage, sizeToPercentage, getElementSize, generateId } from "./utils"

describe("parseSize", () => {
  it("parses numeric values as percentages", () => {
    expect(parseSize(50)).toEqual({ value: 50, unit: "%" })
    expect(parseSize(0)).toEqual({ value: 0, unit: "%" })
    expect(parseSize(100)).toEqual({ value: 100, unit: "%" })
  })

  it("parses pixel strings", () => {
    expect(parseSize("200px")).toEqual({ value: 200, unit: "px" })
    expect(parseSize("50px")).toEqual({ value: 50, unit: "px" })
    expect(parseSize("0px")).toEqual({ value: 0, unit: "px" })
  })

  it("parses percentage strings", () => {
    expect(parseSize("50%")).toEqual({ value: 50, unit: "%" })
    expect(parseSize("100%")).toEqual({ value: 100, unit: "%" })
    expect(parseSize("25.5%")).toEqual({ value: 25.5, unit: "%" })
  })

  it("handles decimal values", () => {
    expect(parseSize("33.333px")).toEqual({ value: 33.333, unit: "px" })
    expect(parseSize(33.333)).toEqual({ value: 33.333, unit: "%" })
  })

  it("handles whitespace", () => {
    expect(parseSize("  200px  ")).toEqual({ value: 200, unit: "px" })
    expect(parseSize(" 50% ")).toEqual({ value: 50, unit: "%" })
  })

  it("returns undefined for invalid values", () => {
    expect(parseSize(undefined)).toBeUndefined()
    expect(parseSize("invalid")).toBeUndefined()
    expect(parseSize("NaNpx")).toBeUndefined()
  })

  it("parses unitless strings as percentages", () => {
    expect(parseSize("50")).toEqual({ value: 50, unit: "%" })
    expect(parseSize("100")).toEqual({ value: 100, unit: "%" })
  })
})

describe("toPercentage", () => {
  it("converts pixels to percentage", () => {
    expect(toPercentage(200, 1000)).toBe(20)
    expect(toPercentage(500, 1000)).toBe(50)
    expect(toPercentage(1000, 1000)).toBe(100)
  })

  it("handles zero container size", () => {
    expect(toPercentage(100, 0)).toBe(0)
  })

  it("handles decimal values", () => {
    expect(toPercentage(333, 1000)).toBe(33.3)
    expect(toPercentage(250, 800)).toBe(31.25)
  })
})

describe("sizeToPercentage", () => {
  it("returns percentage value directly for percentage units", () => {
    expect(sizeToPercentage({ value: 50, unit: "%" }, 1000)).toBe(50)
    expect(sizeToPercentage({ value: 100, unit: "%" }, 1000)).toBe(100)
  })

  it("converts pixel values to percentage", () => {
    expect(sizeToPercentage({ value: 200, unit: "px" }, 1000)).toBe(20)
    expect(sizeToPercentage({ value: 500, unit: "px" }, 1000)).toBe(50)
  })

  it("handles zero container size for pixel values", () => {
    expect(sizeToPercentage({ value: 100, unit: "px" }, 0)).toBe(0)
  })
})

describe("getElementSize", () => {
  it("returns width for horizontal direction", () => {
    const element = document.createElement("div")
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 500, height: 300 }),
    })

    expect(getElementSize(element, "horizontal")).toBe(500)
  })

  it("returns height for vertical direction", () => {
    const element = document.createElement("div")
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 500, height: 300 }),
    })

    expect(getElementSize(element, "vertical")).toBe(300)
  })
})

describe("generateId", () => {
  it("generates unique IDs", () => {
    const id1 = generateId()
    const id2 = generateId()
    const id3 = generateId()

    expect(id1).not.toBe(id2)
    expect(id2).not.toBe(id3)
  })

  it("uses default prefix 'panel'", () => {
    const id = generateId()
    expect(id).toMatch(/^panel-\d+$/)
  })

  it("uses custom prefix", () => {
    const id = generateId("custom")
    expect(id).toMatch(/^custom-\d+$/)
  })

  it("increments counter for each call", () => {
    const id1 = generateId("test")
    const id2 = generateId("test")

    const num1 = Number.parseInt(id1.split("-")[1])
    const num2 = Number.parseInt(id2.split("-")[1])

    expect(num2).toBeGreaterThan(num1)
  })
})
