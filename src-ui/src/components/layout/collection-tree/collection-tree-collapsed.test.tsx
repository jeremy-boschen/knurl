import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CollectionTreeCollapsed } from "./collection-tree-collapsed"

const toggleExpanded = vi.fn()
const expandSidebar = vi.fn()

let collectionsIndex: { id: string; name: string }[] = []
let expandedIds: Record<string, boolean> = {}

vi.mock("@/state", () => ({
  useCollections: () => ({
    state: { collectionsIndex },
  }),
  useCollectionTree: () => ({
    state: { expandedIds },
    actions: { toggleExpanded },
  }),
  useSidebar: () => ({
    actions: { expandSidebar },
  }),
}))

describe("CollectionTreeCollapsed", () => {
  beforeEach(() => {
    collectionsIndex = []
    expandedIds = {}
    vi.clearAllMocks()
  })

  it("opens sidebar and toggles collection expansion on click", async () => {
    collectionsIndex = [
      { id: "c1", name: "One" },
      { id: "c2", name: "Two" },
    ]
    expandedIds = { c1: true }

    render(<CollectionTreeCollapsed />)
    const buttons = screen.getAllByRole("treeitem")
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(buttons[1])

    expect(expandSidebar).toHaveBeenCalledTimes(1)
    expect(toggleExpanded).toHaveBeenCalledWith("c2")
  })

  it("shows more button when more than 10 collections and triggers sidebar expansion", async () => {
    collectionsIndex = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      name: `Col ${i}`,
    }))

    render(<CollectionTreeCollapsed />)

    // Only first 10 rendered
    expect(screen.getAllByRole("treeitem")).toHaveLength(10)

    const moreButton = screen.getByTitle(/show all collections/i)
    await userEvent.click(moreButton)

    expect(expandSidebar).toHaveBeenCalledTimes(1)
    expect(toggleExpanded).not.toHaveBeenCalled()
  })
})
