import { render } from "@testing-library/react"

import { CollectionTree } from "./collection-tree"

vi.mock("@/state", () => ({
  useCollections: vi.fn(() => ({
    state: { collectionsIndex: [] },
    actions: { collectionsApi: vi.fn(() => ({})) },
  })),
  useSidebar: vi.fn(() => ({
    state: { isCollapsed: false },
    actions: { expandSidebar: vi.fn() },
  })),
  useOpenTabs: vi.fn(() => ({
    actions: { requestTabsApi: vi.fn(() => ({})) },
  })),
  useUtilitySheets: vi.fn(() => ({
    actions: { utilitySheetsApi: { openSheet: vi.fn() } },
  })),
  useCollection: vi.fn(() => ({
    state: {
      collection: {
        folders: {},
        requests: {},
      },
    },
  })),
  isScratchCollection: vi.fn(() => false),
}))

describe("CollectionTree", () => {
  it("renders without crashing", () => {
    render(<CollectionTree searchTerm="" />)
  })
})
