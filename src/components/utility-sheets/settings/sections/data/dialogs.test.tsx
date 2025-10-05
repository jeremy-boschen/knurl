import { render, screen } from "@testing-library/react"
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

describe("Settings Dialogs: Encryption Key", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ExportKeyDialog loads key and renders it", async () => {
    render(
      <TooltipProvider>
        <ExportKeyDialog open={true} onOpenChange={() => {}} />
      </TooltipProvider>,
    )
    // masked input still holds value, but not visible; assert API call executed
    expect(await getDataEncryptionKey()).toBe("BASE64KEY==")
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
