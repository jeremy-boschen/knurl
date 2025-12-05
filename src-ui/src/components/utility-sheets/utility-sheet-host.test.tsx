import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { UtilitySheetHost } from "./utility-sheet-host"

const closeSheet = vi.fn()
let activeSheet: any = null

vi.mock("@/state", () => ({
  useUtilitySheets: () => ({
    state: { activeSheet },
    actions: { utilitySheetsApi: { closeSheet } },
  }),
}))

vi.mock("@/components/ui/sheet", () => {
  const React = require("react")
  const Sheet = ({ children, open, onOpenChange }: any) => (
    <div data-sheet-open={open} onClick={() => onOpenChange?.(false)}>
      {children}
    </div>
  )
  // strip forceMount to avoid unknown attribute warning
  const SheetContent = ({ children, forceMount: _fm, ...rest }: any) => (
    <div role="dialog" {...rest}>
      {children}
    </div>
  )
  return { Sheet, SheetContent }
})

vi.mock("@/components/utility-sheets/settings", () => ({ default: () => <div>SettingsSheet</div> }))
vi.mock("@/components/utility-sheets/import-collection", () => ({ default: () => <div>ImportSheet</div> }))
vi.mock("@/components/utility-sheets/export-collection", () => ({ default: ({ collectionId }: any) => <div>Export {collectionId}</div> }))
vi.mock("@/components/utility-sheets/theme-editor", () => ({ default: () => <div>ThemeEditor</div> }))
vi.mock("@/components/utility-sheets/collection-settings", () => ({ default: ({ tab, selectedEnvironmentId }: any) => <div>CollectionSettings {tab} {selectedEnvironmentId}</div> }))

describe("UtilitySheetHost", () => {
  beforeEach(() => {
    activeSheet = null
    closeSheet.mockClear()
  })

  it("renders selected sheet and closes via onOpenChange", async () => {
    activeSheet = { id: "s1", type: "import" }
    const user = userEvent.setup()
    render(<UtilitySheetHost />)

    expect(screen.getByText(/ImportSheet/)).toBeInTheDocument()

    await user.click(screen.getByRole("dialog"))
    expect(closeSheet).toHaveBeenCalled()
  })

  it("returns null when no content for type", () => {
    activeSheet = { id: "s2", type: "export", context: null }
    const { container } = render(<UtilitySheetHost />)
    expect(container.firstChild).toBeNull()
  })

  it("renders environment and collection-settings sheets", () => {
    activeSheet = { id: "env1", type: "environment", context: { collectionId: "c1", selectedEnvironmentId: "envA" } }
    const { rerender } = render(<UtilitySheetHost />)
    expect(screen.getByText(/CollectionSettings environments envA/)).toBeInTheDocument()

    activeSheet = { id: "cs1", type: "collection-settings", context: { collectionId: "c2", tab: "overview" } }
    rerender(<UtilitySheetHost />)
    expect(screen.getByText(/CollectionSettings overview/)).toBeInTheDocument()
  })

  it("unmounts content after close animation timeout", async () => {
    vi.useFakeTimers()
    activeSheet = { id: "s3", type: "settings" }
    const { rerender, container } = render(<UtilitySheetHost />)
    expect(screen.getByText("SettingsSheet")).toBeInTheDocument()

    activeSheet = null
    act(() => {
      rerender(<UtilitySheetHost />)
    })
    // Still mounted until timer fires
    expect(container.firstChild).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(400)
      rerender(<UtilitySheetHost />)
    })
    expect(container.firstChild).toBeNull()
    vi.useRealTimers()
  })
})
