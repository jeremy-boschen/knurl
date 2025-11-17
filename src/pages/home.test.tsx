import { render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

const startupStateMocks = vi.hoisted(() => ({
  getStartupState: vi.fn().mockReturnValue(0),
  setStartupState: vi.fn(),
}))

vi.mock("@/lib/startup-state", () => startupStateMocks)

vi.mock("@/components/layout/app-layout", () => ({
  __esModule: true,
  default: () => <div data-test-id="app-layout">layout</div>,
}))

import Home from "./home"

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sets startup state to 2 when not yet bootstrapped", async () => {
    startupStateMocks.getStartupState.mockReturnValueOnce(0)
    render(<Home />)

    await waitFor(() => expect(startupStateMocks.setStartupState).toHaveBeenCalledWith(2))
    expect(getByDataId("app-layout")).toBeInTheDocument()
  })

  it("does not change startup state when already 2", async () => {
    startupStateMocks.getStartupState.mockReturnValueOnce(2)
    render(<Home />)

    await waitFor(() => expect(startupStateMocks.setStartupState).not.toHaveBeenCalled())
  })
})
