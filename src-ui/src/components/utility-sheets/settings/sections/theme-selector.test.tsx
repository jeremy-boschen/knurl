import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useSettings } from "@/state"
import { ThemeSelector } from "./theme-selector"

vi.mock("@/state", () => ({
  useSettings: vi.fn(),
}))

describe("ThemeSelector", () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error
    global.fetch = mockFetch

    vi.mocked(useSettings).mockReturnValue({
      state: {
        appearance: {
          themeSource: "preset",
          selectedPresetTheme: undefined,
          themeRegistryUrl: "",
        },
      },
      actions: { settingsApi: () => ({ setThemeRegistryUrl: vi.fn() }) },
    } as any)
  })

  afterEach(() => {
    // @ts-expect-error
    delete global.fetch
  })

  it("fetches registry and allows selecting a theme", async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [
        { type: "registry:style", name: "solarized", title: "Solarized", cssVars: { theme: {}, light: {}, dark: {} } },
        { type: "registry:style", name: "dracula", title: "Dracula", cssVars: { theme: {}, light: {}, dark: {} } },
      ] }),
    })

    const onThemeSelect = vi.fn()
    render(<ThemeSelector onThemeSelect={onThemeSelect} />)

    // Click refresh to fetch
    const refresh = screen.getByRole("button", { name: /Fetch themes from registry/i })
    await user.click(refresh)

    // Open combobox
    const trigger = screen.getByRole("combobox")
    await user.click(trigger)

    const list = screen.getByRole("listbox")
    expect(within(list).getByText("Solarized")).toBeInTheDocument()
    expect(within(list).getByText("Dracula")).toBeInTheDocument()

    // Select a theme
    await user.click(within(list).getByText("Dracula"))
    expect(onThemeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "dracula", title: "Dracula" }),
    )
  })

  it("is inert when disabled", async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    const onThemeSelect = vi.fn()
    render(<ThemeSelector onThemeSelect={onThemeSelect} disabled={true} />)

    // Button should have aria-disabled
    const combobox = screen.getByRole("combobox")
    expect(combobox).toHaveAttribute("aria-expanded", "false")
    await user.click(combobox)
    // No popover opens
    expect(screen.queryByRole("listbox")).toBeNull()
  })
})
