import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import SettingsSheet from "./index"

vi.mock("./sections/appearance", () => ({
  __esModule: true,
  default: () => <div data-testid="appearance-section">Appearance</div>,
}))

vi.mock("./sections/requests", () => ({
  __esModule: true,
  default: () => <div data-testid="requests-section">Requests</div>,
}))

vi.mock("./sections/data/data", () => ({
  __esModule: true,
  default: () => <div data-testid="data-section">Data</div>,
}))

vi.mock("./sections/about", () => ({
  __esModule: true,
  default: () => <div data-testid="about-section">About</div>,
}))

vi.mock("@/components/ui/sheet", () => ({
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("SettingsSheet", () => {
  it("switches sections via navigation buttons", async () => {
    const user = userEvent.setup()
    render(<SettingsSheet />)

    expect(screen.getByTestId("appearance-section")).toBeInTheDocument()

    await user.click(getByDataId("settings-nav:requests-button"))
    expect(screen.getByTestId("requests-section")).toBeInTheDocument()

    await user.click(getByDataId("settings-nav:data-button"))
    expect(screen.getByTestId("data-section")).toBeInTheDocument()

    await user.click(getByDataId("settings-nav:about-button"))
    expect(screen.getByTestId("about-section")).toBeInTheDocument()
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}
