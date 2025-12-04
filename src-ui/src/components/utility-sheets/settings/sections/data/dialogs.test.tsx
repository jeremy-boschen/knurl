import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/bindings/knurl", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getDataEncryptionKey: vi.fn(async () => "BASE64KEY=="),
    setDataEncryptionKey: vi.fn(async () => {}),
  }
})
import { getDataEncryptionKey, setDataEncryptionKey } from "@/bindings/knurl"

vi.mock("@/state", () => ({
  useApplication: {
    getState: () => ({
      collectionsState: { index: [] },
      collectionsApi: () => ({ getCollection: vi.fn() }),
      save: vi.fn(),
    }),
  },
}))

import { ExportKeyDialog, ImportKeyDialog } from "./dialogs"
import { TooltipProvider } from "@/components/ui/knurl/tooltip"

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

describe("Settings Dialogs: Encryption Key", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ExportKeyDialog loads key and renders it", async () => {
    await act(async () => {
      render(
        <TooltipProvider>
          <ExportKeyDialog open={true} onOpenChange={() => {}} />
        </TooltipProvider>,
      )
    })
    await waitFor(() => expect(getDataEncryptionKey).toHaveBeenCalled())
  })

  it("ImportKeyDialog sets key through confirmation flow", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<ImportKeyDialog open={true} onOpenChange={onOpenChange} />)

    const area = await screen.findByPlaceholderText(/paste your encryption key/i)
    await user.type(area, "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo9")

    const confirmBtn = screen.getByRole("button", { name: /confirm import/i })
    await user.click(confirmBtn)

    // Confirm the AlertDialog
    const yesBtn = await screen.findByRole("button", { name: /yes, import key/i })
    await user.click(yesBtn)

    expect(setDataEncryptionKey).toHaveBeenCalled()
  })
})
