import type { ReactNode } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AppearanceSection from "./appearance"

const settingsState = {
  appearance: {
    fontSize: 14,
    autoHighlight: false,
    theme: "dark",
    themeSource: "default" as const,
    customThemeUrl: "",
    customTheme: undefined as string | undefined,
    selectedPresetTheme: undefined as string | undefined,
  },
}

const settingsActions = {
  setFontSize: vi.fn(),
  setAutoHighlight: vi.fn(),
  setTheme: vi.fn(),
  setThemeSource: vi.fn(),
  setCustomTheme: vi.fn(),
  setCustomThemeUrl: vi.fn(),
  setSelectedPresetTheme: vi.fn(),
}

const settingsApi = vi.fn(() => settingsActions)
const sheetsOpenMock = vi.fn()

vi.mock("@/state", () => ({
  useSettings: () => ({
    state: settingsState,
    actions: { settingsApi },
  }),
  utilitySheetsApi: () => ({ openSheet: sheetsOpenMock }),
}))

vi.mock("@/components/utility-sheets/settings/sections/theme-selector", () => ({
  ThemeSelector: ({ onThemeSelect, disabled }: { onThemeSelect: (theme: any) => void; disabled?: boolean }) => (
    <button
      type="button"
      data-test-id="appearance:theme-selector"
      disabled={disabled}
      onClick={() => onThemeSelect({ name: "dusk", cssVars: { theme: { primary: "#fff" } } })}
    >
      Apply preset
    </button>
  ),
}))

vi.mock("@/lib/theme/custom-css-vars", () => ({
  ensureCustomCssVarsDetailed: () => ({ ensured: { theme: { primary: "#fff" } }, added: { base: [], dark: [] } }),
}))

const restoreFetch = () => {
  if ((global as any)._appearanceFetch) {
    global.fetch = (global as any)._appearanceFetch
    delete (global as any)._appearanceFetch
  }
}

describe("AppearanceSection", () => {
  beforeEach(() => {
    settingsState.appearance = {
      fontSize: 14,
      autoHighlight: false,
      theme: "dark",
      themeSource: "default",
      customThemeUrl: "",
      customTheme: undefined,
      selectedPresetTheme: undefined,
    }
    Object.values(settingsActions).forEach((fn) => fn.mockClear())
    sheetsOpenMock.mockClear()
    settingsApi.mockClear()
    restoreFetch()
  })

  it("updates basic appearance settings", async () => {
    const user = userEvent.setup()
    render(<AppearanceSection />)

    await user.click(getByDataId("appearance:font-size-trigger"))
    await user.click(await screen.findByText("16px"))
    expect(settingsActions.setFontSize).toHaveBeenCalledWith(16)

    await user.click(getByDataId("appearance:auto-highlight-switch"))
    expect(settingsActions.setAutoHighlight).toHaveBeenCalledWith(true)

    await user.click(getByDataId("appearance:color-scheme-trigger"))
    const lightOptions = await screen.findAllByRole("option", { name: /Light/i })
    await user.click(lightOptions[0])
    expect(settingsActions.setTheme).toHaveBeenCalledWith("light")
  })

  it("applies preset themes, opens editor, and resets", async () => {
    const user = userEvent.setup()
    settingsState.appearance.customTheme = "body { color: red; }"
    settingsState.appearance.themeSource = "preset"
    render(<AppearanceSection />)

    await user.click(getByDataId("appearance:theme-selector"))
    expect(settingsActions.setCustomTheme).toHaveBeenCalled()
    expect(settingsActions.setThemeSource).toHaveBeenCalledWith("preset")

    await user.click(getByDataId("appearance:edit-theme-button"))
    expect(sheetsOpenMock).toHaveBeenCalledWith({ type: "theme-editor" })

    await user.click(getByDataId("appearance:reset-theme-button"))
    expect(settingsActions.setCustomTheme).toHaveBeenCalledWith(undefined)
    expect(settingsActions.setThemeSource).toHaveBeenCalledWith("default")
  })

  it("fetches custom themes via URL flow", async () => {
    const user = userEvent.setup()
    settingsState.appearance.themeSource = "custom"
    settingsState.appearance.customThemeUrl = "https://example.com/theme.json"
    ;(global as any)._appearanceFetch = global.fetch
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ cssVars: { theme: { primary: "#000" } } }),
      status: 200,
      statusText: "OK",
    })) as any

    render(<AppearanceSection />)

    await user.click(getByDataId("appearance:custom-url-fetch-button"))
    await user.click(getByDataId("appearance:fetch-confirm-apply"))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(settingsActions.setCustomTheme).toHaveBeenCalled()
    expect(settingsActions.setThemeSource).toHaveBeenLastCalledWith("custom")
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}
