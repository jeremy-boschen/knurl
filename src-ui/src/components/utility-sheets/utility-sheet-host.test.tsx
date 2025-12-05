import { render, screen } from "@testing-library/react"
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
vi.mock("@/components/utility-sheets/collection-settings", () => ({ default: ({ tab }: any) => <div>CollectionSettings {tab}</div> }))
vi.mock("@/components/utility-sheets/theme-editor", () => ({ default: () => <div>ThemeEditor</div> }))

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
})
