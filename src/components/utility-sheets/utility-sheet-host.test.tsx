import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { UtilitySheetHost } from "./utility-sheet-host"

const utilitySheetsState = {
  state: { activeSheet: null as any },
  actions: { utilitySheetsApi: { closeSheet: vi.fn() } },
}

vi.mock("@/state", () => ({
  useUtilitySheets: () => utilitySheetsState,
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, onOpenChange, children }: any) => (
    <div data-test-id="mock-sheet" data-open={open}>
      <button data-test-id="mock-sheet-close" type="button" onClick={() => onOpenChange?.(false)}>
        Close
      </button>
      {children}
    </div>
  ),
  SheetContent: ({ children, forceMount: _forceMount, ...props }: any) => (
    <div data-test-id="sheet-content" {...props}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/utility-sheets/settings", () => ({ __esModule: true, default: () => <div data-test-id="settings-sheet" /> }))
vi.mock("@/components/utility-sheets/import-collection", () => ({ __esModule: true, default: () => <div data-test-id="import-sheet" /> }))
vi.mock("@/components/utility-sheets/export-collection", () => ({
  __esModule: true,
  default: ({ collectionId }: { collectionId: string }) => <div data-test-id="export-sheet">{collectionId}</div>,
}))
vi.mock("@/components/utility-sheets/collection-settings", () => ({
  __esModule: true,
  default: (props: any) => <div data-test-id="collection-settings-sheet">{JSON.stringify(props)}</div>,
}))
vi.mock("@/components/utility-sheets/theme-editor", () => ({ __esModule: true, default: () => <div data-test-id="theme-editor-sheet" /> }))

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    }
  } else {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  }
})

beforeEach(() => {
  utilitySheetsState.state.activeSheet = null
  utilitySheetsState.actions.utilitySheetsApi.closeSheet.mockClear()
})

describe("UtilitySheetHost", () => {
  it("renders a theme editor sheet and closes via callback", async () => {
    const user = userEvent.setup()
    utilitySheetsState.state.activeSheet = { id: "sheet-1", type: "theme-editor" }

    render(<UtilitySheetHost />)

    await waitFor(() => expect(getByDataId("sheet-content")).toBeInTheDocument())
    expect(getByDataId("sheet-content")).toHaveAttribute("data-kind", "utility-sheet")
    expect(getByDataId("theme-editor-sheet")).toBeInTheDocument()

    await user.click(getByDataId("mock-sheet-close"))
    expect(utilitySheetsState.actions.utilitySheetsApi.closeSheet).toHaveBeenCalled()
  })

  it("aliases environment sheets to collection settings with tab", async () => {
    utilitySheetsState.state.activeSheet = {
      id: "sheet-env",
      type: "environment",
      context: { collectionId: "col-1", selectedEnvironmentId: "env-1" },
    }

    render(<UtilitySheetHost />)

    const payload = JSON.parse(
      (await waitFor(() => getByDataId("collection-settings-sheet"))).textContent ?? "{}",
    )
    expect(payload.tab).toBe("environments")
    expect(payload.collectionId).toBe("col-1")
    expect(payload.selectedEnvironmentId).toBe("env-1")
  })

  it("renders nothing when sheet requires context but none provided", () => {
    utilitySheetsState.state.activeSheet = {
      id: "sheet-export",
      type: "export",
      context: undefined,
    }

    const { container } = render(<UtilitySheetHost />)
    expect(container.firstChild).toBeNull()
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element with data-test-id=${id}`)
  }
  return el as HTMLElement
}
