import { useEffect, useState } from "react"

import { PaletteIcon } from "lucide-react"

import { CodeEditor } from "@/components/editor/code-editor"
import { Button } from "@/components/ui/button"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { appendMissingCustomVars, buildDefaultThemeCss, ensureCustomCssVarsDetailed } from "@/lib/theme/custom-css-vars"
import { useSettings, utilitySheetsApi } from "@/state"
import type { CustomTheme } from "@/types"

const DefaultThemeCss: string = buildDefaultThemeCss()

/**
 * Generates a CSS string from a shadcn/ui theme JSON object.
 * Ensures that app-specific custom variables are present and clearly marked as extras.
 * @param themeJson The parsed theme JSON.
 * @returns A formatted CSS string.
 */
function _generateThemeCss(themeJson: CustomTheme): string {
  const { cssVars } = themeJson
  if (!cssVars) {
    return ""
  }

  // Ensure app-specific variables exist; get which ones we added (extras)
  const { ensured, added } = ensureCustomCssVarsDetailed(cssVars)

  const lines: string[] = []

  const formatSplit = (vars: Record<string, string>, addedKeys: Set<string>): { base: string[]; extra: string[] } => {
    const base: string[] = []
    const extra: string[] = []
    for (const [key, value] of Object.entries(vars)) {
      const line = `  --${key}: ${value};`
      if (addedKeys.has(key)) {
        extra.push(line)
      } else {
        base.push(line)
      }
    }
    return { base, extra }
  }

  // Base variables from the 'theme' key should apply to both light and dark modes.
  const baseVars = ensured.theme ?? {}

  // For :root, extras are those added to base (theme)
  const lightCombined: Record<string, string> = { ...baseVars, ...(ensured.light ?? {}) }
  const lightAddedKeys = new Set<string>(added.base)
  const lightSplit = formatSplit(lightCombined, lightAddedKeys)
  if (lightSplit.base.length + lightSplit.extra.length > 0) {
    lines.push(":root {", ...lightSplit.base)
    if (lightSplit.extra.length > 0) {
      lines.push("  /* Custom variables added by app */", ...lightSplit.extra)
    }
    lines.push("}")
  }

  // For .dark, extras include base additions and dark-specific additions
  const darkCombined: Record<string, string> = { ...baseVars, ...(ensured.dark ?? {}) }
  const darkAddedKeys = new Set<string>([...added.base, ...added.dark])
  const darkSplit = formatSplit(darkCombined, darkAddedKeys)
  if (darkSplit.base.length + darkSplit.extra.length > 0) {
    if (lines.length > 0) {
      lines.push("")
    }
    lines.push(".dark {", ...darkSplit.base)
    if (darkSplit.extra.length > 0) {
      lines.push("  /* Custom variables added by app */", ...darkSplit.extra)
    }
    lines.push("}")
  }

  return lines.join("\n")
}

export default function ThemeEditorSheet() {
  const {
    state: settingsState,
    actions: { settingsApi },
  } = useSettings()
  const sheetsApi = utilitySheetsApi()
  const [customThemeCss, setCustomThemeCss] = useState<string>("")

  useEffect(() => {
    const t = settingsState.appearance.customTheme
    setCustomThemeCss(t || DefaultThemeCss)
  }, [settingsState.appearance.customTheme])

  const handleApplyTheme = () => {
    // We don't validate raw CSS, just apply it.
    // Ensure required custom variables are present by appending any missing ones.
    const cssOut = appendMissingCustomVars(customThemeCss)
    const next = cssOut.trim()
    const current = settingsState.appearance.customTheme?.trim()

    const hasTheme = next.length > 0

    if (!hasTheme) {
      settingsApi().setCustomTheme(undefined)
    } else if (next !== current) {
      settingsApi().setCustomTheme(cssOut)
    }

    if (hasTheme) {
      settingsApi().setThemeSource("custom")
      settingsApi().setSelectedPresetTheme(undefined)
    } else {
      settingsApi().setThemeSource("default")
    }

    sheetsApi.popSheet()
  }

  const handleResetTheme = () => {
    setCustomThemeCss(DefaultThemeCss)
    settingsApi().setCustomTheme(undefined)
    settingsApi().setCustomThemeUrl(undefined)
    settingsApi().setSelectedPresetTheme(undefined)
    settingsApi().setThemeSource("default")
    sheetsApi.popSheet()
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SheetHeader className="border-b px-6 pt-6 pb-4">
        <SheetTitle className="flex items-center gap-2 text-xl">
          <PaletteIcon className="h-5 w-5 text-primary" />
          Edit Theme
        </SheetTitle>
        <SheetDescription>Edit CSS theme variables to customize Knurl's appearance.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 px-6 py-4">
        <div className="relative h-full min-h-0">
          <CodeEditor
            value={customThemeCss}
            onChange={setCustomThemeCss}
            language="css"
            className="absolute inset-0 h-full w-full rounded-sm border"
            lineNumbers={true}
          />
        </div>
      </div>

      <SheetFooter className="border-t px-6 py-4 flex-row justify-end gap-2">
        <Button variant="outline" onClick={handleResetTheme}>
          Reset to Default
        </Button>
        <Button variant="default" onClick={handleApplyTheme}>
          Apply
        </Button>
      </SheetFooter>
    </div>
  )
}
