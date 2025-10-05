import { mockIPC } from "@tauri-apps/api/mocks"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CopyToClipboard } from "./copy"
import { TooltipProvider } from "@/components/ui/knurl/tooltip"

beforeEach(() => {
  vi.resetModules()
  vi.useRealTimers()
  vi.clearAllMocks()

  mockIPC((cmd) => {
    if (cmd === "plugin:clipboard-manager|write_text") {
      return Promise.resolve()
    }
    return Promise.resolve()
  })
})

describe("CopyToClipboard", () => {
  it("copies provided content to clipboard and shows tooltip feedback", async () => {
    const user = userEvent.setup()
    // Spy on Tauri's internal invoke() to ensure clipboard calls go through IPC
    const invokeSpy = vi.spyOn((window as any).__TAURI_INTERNALS__, "invoke")

    render(
      <TooltipProvider>
        <CopyToClipboard content="hello" timeout={500} />
      </TooltipProvider>,
    )

    const button = screen.getByRole("button", { name: /copy to clipboard/i })
    await user.click(button)

    expect(invokeSpy).toHaveBeenCalled()

    // Prefer the role over the raw text; then ensure it's the OPEN instance
    const openTooltip = await screen.findByRole("tooltip")
    expect(openTooltip).toHaveTextContent(/copied to clipboard/i)

    // Wait for the tooltip to disappear after timeout
    await waitFor(
      () => {
        expect(screen.queryByText(/copied to clipboard/i)).not.toBeInTheDocument()
      },
      { timeout: 1000 }, // Wait up to 1 second for the tooltip to disappear
    )
  })

  it("is disabled when no content and does not copy", async () => {
    const user = userEvent.setup()
    const invokeSpy = vi.spyOn((window as any).__TAURI_INTERNALS__, "invoke")

    render(
      <TooltipProvider>
        <CopyToClipboard content={null} />
      </TooltipProvider>,
    )

    const button = screen.getByRole("button", { name: /copy to clipboard/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)

    await user.click(button)

    expect(invokeSpy).not.toHaveBeenCalled()
  })
})
