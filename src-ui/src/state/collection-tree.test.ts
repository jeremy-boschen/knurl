import { describe, expect, it } from "vitest"

import { collectionTreeSliceCreator } from "./collection-tree"

describe("collectionTreeSliceCreator", () => {
  const createSlice = () => {
    let app: any
    const set = (fn: (draft: any) => void) => fn(app)
    const slice = collectionTreeSliceCreator(set as any)
    app = { ...slice }
    return { app, api: slice.collectionTreeApi }
  }

  it("sets and clears search term", () => {
    const { app, api } = createSlice()
    api.setSearchTerm("hello")
    expect(app.collectionTreeState.searchTerm).toBe("hello")
    api.clearSearch()
    expect(app.collectionTreeState.searchTerm).toBe("")
  })

  it("toggles expanded ids", () => {
    const { app, api } = createSlice()
    api.toggleExpanded("a")
    expect(app.collectionTreeState.expandedIds).toEqual({ a: true })
    api.toggleExpanded("a")
    expect(app.collectionTreeState.expandedIds).toEqual({})
  })

  it("sets expanded state explicitly", () => {
    const { app, api } = createSlice()
    api.setExpanded("b", true)
    expect(app.collectionTreeState.expandedIds).toEqual({ b: true })
    api.setExpanded("b", false)
    expect(app.collectionTreeState.expandedIds).toEqual({})
  })
})
