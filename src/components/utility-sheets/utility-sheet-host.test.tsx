import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import { UtilitySheetHost } from "./utility-sheet-host"

const hoisted = vi.hoisted(() => ({
  useUtilitySheets: vi.fn(),
}))

vi.mock("@/state", () => hoisted)

function sheetStub(id: string) {
  return () => <div data-testid={`sheet-${id}`} />
}

vi.mock("@/components/utility-sheets/settings", () => ({ __esModule: true, default: sheetStub("settings") }))
vi.mock("@/components/utility-sheets/import-collection", () => ({ __esModule: true, default: sheetStub("import") }))
vi.mock("@/components/utility-sheets/export-collection", () => ({ __esModule: true, default: ({ collectionId }: { collectionId: string }) => (
  <div data-testid="sheet-export">{collectionId}</div>
) }))

const collectionSettingsSpy = vi.fn()
vi.mock("@/components/utility-sheets/collection-settings", () => ({
  __esModule: true,
  default: (props: any) => {
    collectionSettingsSpy(props)
    return <div data-testid="sheet-collection-settings" />
  },
}))

vi.mock("@/components/utility-sheets/theme-editor", () => ({ __esModule: true, default: sheetStub("theme") }))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <div data-testid="utility-sheet" data-open={open}>
      <button data-testid="utility-sheet:close" onClick={() => onOpenChange?.(false)}>
        close
      </button>
      {children}
    </div>
  ),
  SheetContent: ({ children, forceMount: _forceMount, ...props }: any) => (
    <div data-testid="utility-sheet-content" {...props}>
      {children}
    </div>
  ),
}))

describe("UtilitySheetHost", () => {
  const closeSheet = vi.fn()
  let currentValue: any

  beforeAll(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    closeSheet.mockReset()
    collectionSettingsSpy.mockReset()
    currentValue = {
      state: { activeSheet: null },
      actions: { utilitySheetsApi: { closeSheet } },
    }
    hoisted.useUtilitySheets.mockImplementation(() => currentValue)
  })

  it("renders nothing when there is no active sheet", () => {
    const { container } = render(<UtilitySheetHost />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the targeted sheet and closes via onOpenChange", async () => {
    currentValue = {
      state: { activeSheet: { id: "s1", type: "settings" } },
      actions: { utilitySheetsApi: { closeSheet } },
    }
    const user = userEvent.setup()
    render(<UtilitySheetHost />)
    expect(await screen.findByTestId("sheet-settings")).toBeInTheDocument()

    await user.click(screen.getByTestId("utility-sheet:close"))
    expect(closeSheet).toHaveBeenCalled()
  })

  it("routes environment sheets through collection settings and clears once closed", () => {
    vi.useFakeTimers()
    currentValue = {
      state: {
        activeSheet: {
          id: "env",
          type: "environment",
          context: { collectionId: "col-1", selectedEnvironmentId: "env-2" },
        },
      },
      actions: { utilitySheetsApi: { closeSheet } },
    }

    const { rerender } = render(<UtilitySheetHost />)
    expect(collectionSettingsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: "col-1", selectedEnvironmentId: "env-2", tab: "environments" }),
    )

    currentValue = {
      state: { activeSheet: null },
      actions: { utilitySheetsApi: { closeSheet } },
    }
    rerender(<UtilitySheetHost />)
    act(() => {
      vi.runAllTimers()
    })
    const assertion = waitFor(() => {
      expect(screen.queryByTestId("sheet-collection-settings")).toBeNull()
    })
    vi.useRealTimers()
    return assertion
  })
})
