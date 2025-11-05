import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useSettings, utilitySheetsApi } from "@/state"
import AppearanceSection from "./appearance"

vi.mock("@/state", () => ({
  useSettings: vi.fn(),
  utilitySheetsApi: vi.fn(),
}))

describe("AppearanceSection", () => {
  const setFontSize = vi.fn()
  const setAutoHighlight = vi.fn()
  const setTheme = vi.fn()
  const setThemeSource = vi.fn()
  const setSelectedPresetTheme = vi.fn()
  const setCustomTheme = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useSettings).mockReturnValue({
      state: {
        appearance: {
          fontSize: 14,
          autoHighlight: true,
          theme: "dark",
          themeSource: "default",
          customTheme: undefined,
          customThemeUrl: undefined,
          selectedPresetTheme: undefined,
          themeRegistryUrl: "",
        },
      },
      actions: {
        settingsApi: () => ({
          setFontSize,
          setAutoHighlight,
          setTheme,
          setThemeSource,
          setSelectedPresetTheme,
          setCustomTheme,
        }),
      },
    } as any)

    vi.mocked(utilitySheetsApi).mockReturnValue({
      openSheet: vi.fn(),
    } as any)
  })

  it("changes font size via Select and toggles auto-highlight", async () => {
    const user = userEvent.setup()
    render(<AppearanceSection />)

    // Font size select trigger is the first combobox
    const fontCombo = screen.getAllByRole("combobox")[0]
    await user.click(fontCombo)
    const listbox = await screen.findByRole("listbox")
    await user.click(within(listbox).getByText("16px"))
    expect(setFontSize).toHaveBeenCalledWith(16)

    const syntaxSwitch = screen.getAllByRole("switch")[0]
    await user.click(syntaxSwitch)
    expect(setAutoHighlight).toHaveBeenCalledWith(false)
  })

  it("changes theme and theme source via Select and radio group", async () => {
    const user = userEvent.setup()
    render(<AppearanceSection />)

    // Change color scheme (second combobox on the page)
    const schemeCombo = screen.getAllByRole("combobox")[1]
    await user.click(schemeCombo)
    const listbox = await screen.findByRole("listbox")
    await user.click(within(listbox).getByText(/Light/i))
    expect(setTheme).toHaveBeenCalledWith("light")

    // Change theme source to preset via its accessible label
    const presetRadio = screen.getByLabelText(/Presets/i)
    await user.click(presetRadio)
    expect(setThemeSource).toHaveBeenCalledWith("preset")
  })
})
