import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { openPath } from "@tauri-apps/plugin-opener"
import { useSettings } from "@/state"
import DataSection from "./data"
import { TooltipProvider } from "@/components/ui/knurl/tooltip"

vi.mock("@/state", () => ({
  useSettings: vi.fn(),
}))

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(),
}))

vi.mock("@/components/ui/knurl/dialog", () => {
  const React = require("react")
  const Wrap = ({ children, ...rest }: any) => <div role="dialog" {...rest}>{children}</div>
  return {
    Dialog: ({ children }: any) => <div>{children}</div>,
    DialogContent: Wrap,
    DialogFooter: ({ children }: any) => <div>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  }
})

vi.mock("@/components/ui/alert-dialog", () => {
  const React = require("react")
  const Wrap = ({ children, ...rest }: any) => <div role="alertdialog" {...rest}>{children}</div>
  const Btn = ({ children, onClick, ...rest }: any) => <button onClick={onClick} {...rest}>{children}</button>
  return {
    AlertDialog: ({ children }: any) => <div>{children}</div>,
    AlertDialogContent: Wrap,
    AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: any) => <h3>{children}</h3>,
    AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
    AlertDialogAction: Btn,
    AlertDialogCancel: Btn,
  }
})

describe("DataSection", () => {
  const setAutoSaveRequests = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSettings).mockReturnValue({
      state: {
        requests: { autoSave: 5 },
        data: { appDataDir: "C:/data/knurl" },
      },
      actions: { settingsApi: () => ({ setAutoSaveRequests }) },
    } as any)
  })

  it("changes auto-save interval", () => {
    render(<DataSection />)
    const input = screen.getByRole("spinbutton")
    fireEvent.change(input, { target: { value: "12" } })
    expect(setAutoSaveRequests).toHaveBeenCalledWith(12)
  })

  it("opens export/import dialogs when buttons clicked", async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <DataSection />
      </TooltipProvider>,
    )

    await user.click(screen.getByRole("button", { name: /Export Key/i }))
    expect(screen.getByText(/Export Encryption Key/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Import Key/i }))
    expect(screen.getByText(/Import Encryption Key/i)).toBeInTheDocument()
  })

  it("opens app data directory via button", async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <DataSection />
      </TooltipProvider>,
    )
    const openBtn = screen.getByRole("button", { name: /Open storage location/i })
    await user.click(openBtn)
    expect(openPath).toHaveBeenCalledWith("C:/data/knurl")
  })
})
