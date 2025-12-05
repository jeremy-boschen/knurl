import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WindowControlDropdownMenuContent } from "./window-control-context-menu"

const windowApi = {
  isMaximized: vi.fn(),
  isMinimized: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  unmaximize: vi.fn(),
  unminimize: vi.fn(),
  close: vi.fn(),
}

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => windowApi),
}))

const { getCurrentWindow } = await import("@tauri-apps/api/window")

describe("WindowControlDropdownMenuContent", () => {
  beforeEach(() => {
    Object.values(windowApi).forEach((fn) => "mockReset" in fn && (fn as any).mockReset())
    windowApi.isMaximized.mockResolvedValue(false)
    windowApi.isMinimized.mockResolvedValue(false)
    vi.mocked(getCurrentWindow).mockReturnValue(windowApi as any)
  })

  it("disables restore when window is neither minimized nor maximized", async () => {
    render(
      <DropdownMenu open onOpenChange={() => {}}>
        <DropdownMenuTrigger asChild>
          <button>open</button>
        </DropdownMenuTrigger>
        <WindowControlDropdownMenuContent />
      </DropdownMenu>,
    )

    const restoreItem = document.querySelector('[data-action-id="restore"]') as HTMLElement
    await waitFor(() => expect(restoreItem.getAttribute("data-disabled")).not.toBeNull())
  })

  it("restores from maximized state", async () => {
    windowApi.isMaximized.mockResolvedValue(true)
    render(
      <DropdownMenu open onOpenChange={() => {}}>
        <DropdownMenuTrigger asChild>
          <button>open</button>
        </DropdownMenuTrigger>
        <WindowControlDropdownMenuContent />
      </DropdownMenu>,
    )
    const restoreItem = document.querySelector('[data-action-id="restore"]') as HTMLElement

    await waitFor(() => expect(restoreItem.getAttribute("data-disabled")).toBeNull())
    await userEvent.click(restoreItem)

    expect(windowApi.unmaximize).toHaveBeenCalled()
  })

  it("invokes minimize, maximize, and close actions", async () => {
    render(
      <DropdownMenu open onOpenChange={() => {}}>
        <DropdownMenuTrigger asChild>
          <button>open</button>
        </DropdownMenuTrigger>
        <WindowControlDropdownMenuContent />
      </DropdownMenu>,
    )
    await waitFor(() => expect(windowApi.isMaximized).toHaveBeenCalled())

    const minimizeItem = document.querySelector('[data-action-id="minimize"]') as HTMLElement
    const maximizeItem = document.querySelector('[data-action-id="maximize"]') as HTMLElement
    const closeItem = document.querySelector('[data-action-id="close"]') as HTMLElement

    await userEvent.click(minimizeItem)
    await userEvent.click(maximizeItem)
    await userEvent.click(closeItem)

    await waitFor(() => expect(windowApi.minimize).toHaveBeenCalled())
    await waitFor(() => expect(windowApi.maximize).toHaveBeenCalled())
    await waitFor(() => expect(windowApi.close).toHaveBeenCalled())
  })
})
