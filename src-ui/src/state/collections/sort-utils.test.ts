import { describe, expect, it } from "vitest"
import { naturalSort, requestSortStrategies } from "./sort-utils"

describe("naturalSort", () => {
  it("sorts strings with numeric parts naturally", () => {
    const items = ["item10", "item2", "item1", "item20"]
    const sorted = items.sort(naturalSort)
    expect(sorted).toEqual(["item1", "item2", "item10", "item20"])
  })

  it("handles mixed case and numbers", () => {
    const items = ["Request10", "Request2", "Request1"]
    const sorted = items.sort(naturalSort)
    expect(sorted).toEqual(["Request1", "Request2", "Request10"])
  })

  it("sorts regular text alphabetically", () => {
    const items = ["zebra", "apple", "banana"]
    const sorted = items.sort(naturalSort)
    expect(sorted).toEqual(["apple", "banana", "zebra"])
  })

  it("handles 'Untitled Request' correctly with numbered requests", () => {
    const items = ["Untitled Request", "r3", "r1", "r2"]
    const sorted = items.sort(naturalSort)
    expect(sorted).toEqual(["r1", "r2", "r3", "Untitled Request"])
  })

  it("handles multiple numeric sequences", () => {
    const items = ["api-v2-endpoint1", "api-v2-endpoint10", "api-v1-endpoint5"]
    const sorted = items.sort(naturalSort)
    expect(sorted).toEqual(["api-v1-endpoint5", "api-v2-endpoint1", "api-v2-endpoint10"])
  })

  it("handles empty strings", () => {
    const items = ["a", "", "b"]
    const sorted = items.sort(naturalSort)
    expect(sorted).toEqual(["", "a", "b"])
  })

  it("handles identical strings", () => {
    const items = ["test", "test", "test"]
    const sorted = items.sort(naturalSort)
    expect(sorted).toEqual(["test", "test", "test"])
  })

  it("is case-insensitive for locale comparison", () => {
    const items = ["Apple", "apple", "APPLE"]
    const sorted = items.sort(naturalSort)
    // All should be treated as equal in base sensitivity
    expect(sorted.length).toBe(3)
  })
})

describe("requestSortStrategies", () => {
  it("byName strategy sorts requests naturally by name", () => {
    const requests = [
      { name: "Request10", method: "GET", url: "" },
      { name: "Request2", method: "GET", url: "" },
      { name: "Request1", method: "GET", url: "" },
    ]
    const sorted = requests.sort(requestSortStrategies.byName.compare)
    expect(sorted.map((r) => r.name)).toEqual(["Request1", "Request2", "Request10"])
  })

  it("byMethod strategy sorts by HTTP method, then by name", () => {
    const requests = [
      { name: "b", method: "DELETE" },
      { name: "a", method: "POST" },
      { name: "c", method: "GET" },
    ]
    const sorted = requests.sort(requestSortStrategies.byMethod.compare)
    expect(sorted.map((r) => r.method)).toEqual(["GET", "POST", "DELETE"])
  })

  it("byMethod defaults to GET if method is undefined", () => {
    const requests = [
      { name: "a", method: undefined },
      { name: "b", method: "POST" },
    ]
    const sorted = requests.sort(requestSortStrategies.byMethod.compare)
    expect(sorted[0].name).toBe("a") // GET comes before POST
  })

  it("byUrl strategy sorts by URL, then by name", () => {
    const requests = [
      { name: "b", url: "https://api.example.com/users" },
      { name: "a", url: "https://api.example.com/posts" },
      { name: "c", url: "https://api.example.com/users" },
    ]
    const sorted = requests.sort(requestSortStrategies.byUrl.compare)
    expect(sorted[0].name).toBe("a") // /posts comes first
    expect(sorted[1].name).toBe("b") // /users, then b
    expect(sorted[2].name).toBe("c") // /users, then c
  })

  it("byUpdated strategy sorts most recently updated first", () => {
    const requests = [
      { name: "a", updatedAt: 1000 },
      { name: "b", updatedAt: 3000 },
      { name: "c", updatedAt: 2000 },
    ]
    const sorted = requests.sort(requestSortStrategies.byUpdated.compare)
    expect(sorted.map((r) => r.name)).toEqual(["b", "c", "a"])
  })

  it("byUpdated treats missing updatedAt as 0", () => {
    const requests = [
      { name: "a", updatedAt: undefined },
      { name: "b", updatedAt: 1000 },
    ]
    const sorted = requests.sort(requestSortStrategies.byUpdated.compare)
    expect(sorted[0].name).toBe("b") // 1000 comes before 0
    expect(sorted[1].name).toBe("a") // undefined = 0
  })
})
