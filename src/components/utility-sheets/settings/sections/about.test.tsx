import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AboutSection from "./about"

const getVersion = vi.fn()
const getTauriVersion = vi.fn()

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: (...args: any[]) => getVersion(...args),
  getTauriVersion: (...args: any[]) => getTauriVersion(...args),
}))

describe("Settings AboutSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("displays fetched version data and quick links", async () => {
    getVersion.mockResolvedValue("1.2.3")
    getTauriVersion.mockResolvedValue("2.0.0")

    render(<AboutSection />)
    expect(await screen.findByText(/v1.2.3/)).toBeInTheDocument()
    expect(getByDataId("settings-about:repository-link")).toHaveAttribute("href", expect.stringContaining("github"))
    expect(getByDataId("settings-about:license-link")).toHaveAttribute("href", expect.stringContaining("LICENSE"))
    expect(getByDataId("settings-about:third-party-link")).toHaveAttribute("href", expect.stringContaining("THIRD_PARTY"))
  })

  it("falls back to unknown when version fetch fails", async () => {
    getVersion.mockRejectedValue(new Error("offline"))
    getTauriVersion.mockRejectedValue(new Error("offline"))
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<AboutSection />)
    await waitFor(() => expect(screen.getByText(/vunknown/i)).toBeInTheDocument())
    consoleSpy.mockRestore()
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}
