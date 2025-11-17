import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const themeMocks = vi.hoisted(() => ({
  appendMissingCustomVars: vi.fn((css: string) => `${css}\n/*app-vars*/`),
  buildDefaultThemeCss: vi.fn(() => "/*default-css*/"),
  ensureCustomCssVarsDetailed: vi.fn(() => ({ ensured: {}, added: { base: [], dark: [] } })),
}))

vi.mock("@/lib/theme/custom-css-vars", () => themeMocks)
const { appendMissingCustomVars } = themeMocks

const settingsState = vi.hoisted(() => ({ appearance: { customTheme: "body { color: red; }" } }))

const settingsActions = vi.hoisted(() => ({
  setCustomTheme: vi.fn(),
  setThemeSource: vi.fn(),
  setSelectedPresetTheme: vi.fn(),
  setCustomThemeUrl: vi.fn(),
}))

const settingsApi = vi.fn(() => settingsActions)

const sheetsPopMock = vi.fn()

vi.mock("@/state", () => ({
  useSettings: () => ({
    state: settingsState,
    actions: { settingsApi },
  }),
  utilitySheetsApi: () => ({ popSheet: sheetsPopMock }),
}))

vi.mock("@/components/ui/sheet", () => ({
  SheetHeader: ({ children }: { children: ReactNode }) => <div data-testid="sheet-header">{children}</div>,
  SheetFooter: ({ children }: { children: ReactNode }) => <div data-testid="sheet-footer">{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}))

vi.mock("@/components/editor/code-editor", () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <textarea data-testid="theme-editor:editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

import ThemeEditorSheet from "./index"

const setup = () => render(<ThemeEditorSheet />)

beforeEach(() => {
  Object.values(settingsActions).forEach((fn) => fn.mockClear())
  appendMissingCustomVars.mockClear()
  sheetsPopMock.mockClear()
})

describe("ThemeEditorSheet", () => {
  it("applies edited CSS and sets custom theme", async () => {
    settingsState.appearance.customTheme = "body { color: red; }"
    setup()
    const editor = screen.getByTestId("theme-editor:editor")
    fireEvent.change(editor, { target: { value: ".dark { color: white; }" } })

    await userEvent.click(screen.getByRole("button", { name: /apply/i }))

    expect(appendMissingCustomVars).toHaveBeenCalledWith(".dark { color: white; }")
    expect(settingsActions.setCustomTheme).toHaveBeenCalledWith(expect.stringContaining("/*app-vars*/"))
    expect(settingsActions.setThemeSource).toHaveBeenCalledWith("custom")
    expect(settingsActions.setSelectedPresetTheme).toHaveBeenCalledWith(undefined)
    expect(sheetsPopMock).toHaveBeenCalled()
  })

  it("clears theme when editor is empty", async () => {
    settingsState.appearance.customTheme = "existing"
    appendMissingCustomVars.mockReturnValueOnce("")
    setup()
    const editor = screen.getByTestId("theme-editor:editor")
    fireEvent.change(editor, { target: { value: "   " } })

    await userEvent.click(screen.getByRole("button", { name: /apply/i }))

    expect(settingsActions.setCustomTheme).toHaveBeenCalledWith(undefined)
    expect(settingsActions.setThemeSource).toHaveBeenCalledWith("default")
    expect(settingsActions.setSelectedPresetTheme).not.toHaveBeenCalled()
    expect(sheetsPopMock).toHaveBeenCalled()
  })

  it("resets to default CSS and clears saved values", async () => {
    settingsState.appearance.customTheme = "custom"
    setup()

    await userEvent.click(screen.getByRole("button", { name: /reset to default/i }))

    expect(settingsActions.setCustomTheme).toHaveBeenCalledWith(undefined)
    expect(settingsActions.setCustomThemeUrl).toHaveBeenCalledWith(undefined)
    expect(settingsActions.setSelectedPresetTheme).toHaveBeenCalledWith(undefined)
    expect(settingsActions.setThemeSource).toHaveBeenCalledWith("default")
    expect(screen.getByTestId("theme-editor:editor")).toHaveValue("/*default-css*/")
    expect(sheetsPopMock).toHaveBeenCalled()
  })

  it("keeps existing theme when contents are unchanged", async () => {
    settingsState.appearance.customTheme = "body { color: red; }"
    appendMissingCustomVars.mockReturnValueOnce("body { color: red; }")
    setup()

    await userEvent.click(screen.getByRole("button", { name: /apply/i }))

    expect(settingsActions.setCustomTheme).not.toHaveBeenCalled()
    expect(settingsActions.setThemeSource).toHaveBeenCalledWith("custom")
    expect(sheetsPopMock).toHaveBeenCalled()
  })

  it("falls back to default CSS when no saved theme exists", () => {
    settingsState.appearance.customTheme = undefined
    setup()

    expect(screen.getByTestId("theme-editor:editor")).toHaveValue("/*default-css*/")
  })
})
