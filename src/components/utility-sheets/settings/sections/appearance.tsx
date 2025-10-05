import { useState } from "react"

import {
  AlertTriangleIcon,
  MonitorCogIcon,
  MoonIcon,
  PencilIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SunIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/knurl/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib"
import { ensureCustomCssVarsDetailed } from "@/lib/theme/custom-css-vars"
import { useSettings, utilitySheetsApi } from "@/state"
import type { CustomTheme, Theme, ThemeSource } from "@/types"
import { zCustomTheme } from "@/types/settings"
import { SettingRow } from "./setting-row"
import { ThemeSelector } from "./theme-selector"

type PresetTheme = CustomTheme & { name: string; title?: string }

/**
 * Generates a CSS string from a shadcn/ui theme JSON object.
 * Ensures that app-specific custom variables are present and clearly marked as extras.
 * @param themeJson The parsed theme JSON.
 * @returns A formatted CSS string.
 */
function generateThemeCss(themeJson: CustomTheme): string {
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

export default function AppearanceSection() {
  const {
    state: settingsState,
    actions: { settingsApi },
  } = useSettings()
  const [fetchCustomTheme, setFetchCustomTheme] = useState<{ pending?: boolean; error?: Error }>({})
  const [isFetchConfirmOpen, setIsFetchConfirmOpen] = useState(false)

  const sheetsApi = utilitySheetsApi()
  const themeSource = settingsState.appearance.themeSource ?? "default"
  const isPresetSource = themeSource === "preset"
  const isCustomSource = themeSource === "custom"

  const handlePresetThemeChange = (theme: PresetTheme) => {
    const css = generateThemeCss(theme)
    settingsApi().setCustomTheme(css)
    settingsApi().setCustomThemeUrl(undefined) // Clear URL when preset is chosen
    settingsApi().setSelectedPresetTheme(theme.name)
    settingsApi().setThemeSource("preset")
    setFetchCustomTheme({}) // Clear any previous fetch error
  }

  const onClearCustomTheme = () => {
    setFetchCustomTheme({})
    setIsFetchConfirmOpen(false)
    settingsApi().setCustomTheme(undefined)
    settingsApi().setCustomThemeUrl(undefined)
    settingsApi().setSelectedPresetTheme(undefined)
    settingsApi().setThemeSource("default")
  }

  const openThemeEditorDialog = () => {
    sheetsApi.openSheet({ type: "theme-editor" })
  }

  const fetchThemeFromUrl = async () => {
    if (!settingsState.appearance.customThemeUrl) {
      return
    }
    try {
      setFetchCustomTheme({
        pending: true,
      })

      const res = await fetch(settingsState.appearance.customThemeUrl)
      if (!res.ok) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(`Failed to fetch theme: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()

      const parsed = zCustomTheme.safeParse({ cssVars: data.cssVars })
      if (!parsed.success) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(parsed.error.issues.map((e) => e.message).join("; "))
      }

      // On success, generate CSS from the theme and apply it
      const css = generateThemeCss(parsed.data)
      settingsApi().setCustomTheme(css)
      settingsApi().setSelectedPresetTheme(undefined) // Clear preset theme
      settingsApi().setThemeSource("custom")

      setFetchCustomTheme({
        pending: false,
      })
    } catch (e) {
      console.error(`Error while fetching custom theme ${settingsState.appearance.customThemeUrl}`, e)
      setFetchCustomTheme({
        pending: false,
        error: e as Error,
      })
    }
  }

  const handleThemeSourceChange = (next: ThemeSource) => {
    if (next === themeSource) {
      return
    }
    setIsFetchConfirmOpen(false)
    setFetchCustomTheme({})

    switch (next) {
      case "default":
        onClearCustomTheme()
        break
      case "preset":
        settingsApi().setThemeSource("preset")
        break
      case "custom":
        settingsApi().setThemeSource("custom")
        settingsApi().setSelectedPresetTheme(undefined)
        break
      default:
        break
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 p-1">
      <SettingRow
        label="Font Size"
        description="Adjust the base font size (affects overall UI scale)."
        className="gap-2"
      >
        <Select
          value={String(Math.round(settingsState.appearance.fontSize))}
          onValueChange={(v) => settingsApi().setFontSize(Number(v))}
        >
          <SelectTrigger className="w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 13, 14, 15, 16, 18, 20, 22].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Syntax Highlighting" description="Enable syntax highlighting in editors" className="gap-2">
        <Switch
          checked={settingsState.appearance.autoHighlight}
          onCheckedChange={(checked) => settingsApi().setAutoHighlight(checked)}
        />
      </SettingRow>

      <Separator className="mt-4 mb-4" />

      <SettingRow label="Color Scheme" description="Change the application color scheme." className="gap-2">
        <Select value={settingsState.appearance.theme} onValueChange={(v) => settingsApi().setTheme(v as Theme)}>
          <SelectTrigger className="w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">
              <MoonIcon /> Dark
            </SelectItem>
            <SelectItem value="light">
              <SunIcon /> Light
            </SelectItem>
            <SelectItem value="system">
              <MonitorCogIcon /> System
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Presets row: registry URL + preset select + chevrons */}

      <SettingRow
        label="Theme Source"
        description="Choose whether to stay with defaults, browse presets, or load your own theme."
        className="flex flex-col items-stretch gap-3"
      >
        <RadioGroup
          value={themeSource}
          onValueChange={(value) => handleThemeSourceChange(value as ThemeSource)}
          className="grid gap-2 md:grid-cols-3"
        >
          {(
            [
              {
                value: "default" as ThemeSource,
                title: "Default",
                subtitle: "Use Knurl's built-in colors.",
              },
              {
                value: "preset" as ThemeSource,
                title: "Presets",
                subtitle: "Apply a theme from a registry preset.",
              },
              {
                value: "custom" as ThemeSource,
                title: "Custom URL",
                subtitle: "Fetch JSON from a URL to build a theme.",
              },
            ] satisfies Array<{ value: ThemeSource; title: string; subtitle: string }>
          ).map(({ value, title, subtitle }) => {
            const id = `theme-source-${value}`
            const isActive = themeSource === value
            return (
              <Label
                key={value}
                htmlFor={id}
                className={cn(
                  "cursor-pointer rounded-md border border-border bg-muted/5 p-3 transition hover:border-primary/60",
                  "flex items-start gap-3",
                  isActive && "border-primary/80 bg-primary/5 ring-1 ring-primary/30",
                )}
              >
                <RadioGroupItem value={value} id={id} className="mt-0.5" />
                <div className="space-y-1">
                  <span className="text-sm font-medium">{title}</span>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
              </Label>
            )
          })}
        </RadioGroup>
      </SettingRow>

      <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
        <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-300" aria-hidden />
        <span>Remote themes can include malicious CSS—only import or edit themes from sources you trust.</span>
      </div>

      <SettingRow
        label="Theme Presets"
        description="Browse curated palettes from a registry."
        className="flex flex-col items-stretch gap-3"
      >
        <div aria-disabled={!isPresetSource} className={cn(!isPresetSource && "opacity-60")}>
          <ThemeSelector onThemeSelect={handlePresetThemeChange} disabled={!isPresetSource} />
        </div>
      </SettingRow>

      <SettingRow
        label="Custom Theme URL"
        description="Fetch a theme JSON and apply it as CSS variables."
        className="flex flex-col items-stretch gap-3"
      >
        <div aria-disabled={!isCustomSource} className={cn("space-y-1", !isCustomSource && "opacity-60")}>
          <Input
            placeholder="https://example.com/theme.json"
            value={settingsState.appearance.customThemeUrl ?? ""}
            onChange={(e) => settingsApi().setCustomThemeUrl(e.target.value)}
            className="w-full"
            disabled={!isCustomSource}
            endAddon={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (isCustomSource) {
                    setIsFetchConfirmOpen(true)
                  }
                }}
                disabled={
                  !isCustomSource || fetchCustomTheme.pending || !settingsState.appearance.customThemeUrl?.trim()
                }
                aria-label="Fetch theme from URL"
                title="Fetch theme from URL"
              >
                <RefreshCwIcon className={cn("h-4 w-4", fetchCustomTheme.pending && "animate-spin")} />
              </Button>
            }
          />
          {fetchCustomTheme.error && isCustomSource && (
            <p className="text-xs text-red-400">{fetchCustomTheme.error.message}</p>
          )}
        </div>
      </SettingRow>

      <SettingRow
        label="Theme Tools"
        description="Edit the active theme or reset it back to default."
        className="flex flex-col items-stretch gap-2"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openThemeEditorDialog}
            aria-label="Edit theme manually"
          >
            <PencilIcon className="mr-2 h-4 w-4" /> Edit theme
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearCustomTheme}
            aria-label="Reset theme to defaults"
            disabled={themeSource === "default" && !settingsState.appearance.customTheme}
          >
            <RotateCcwIcon className="mr-2 h-4 w-4" /> Reset to default
          </Button>
        </div>
      </SettingRow>

      <AlertDialog open={isFetchConfirmOpen} onOpenChange={setIsFetchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fetch Remote Theme?</AlertDialogTitle>
          </AlertDialogHeader>
          <Alert variant="default" className="border-amber-500/50 text-amber-200 [&>svg]:text-amber-400">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Security Warning</AlertTitle>
            <AlertDescription>
              Use caution with themes from untrusted sources. Malicious CSS can potentially exploit browser
              vulnerabilities or exfiltrate data.
            </AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={fetchThemeFromUrl} disabled={fetchCustomTheme.pending}>
              Fetch and Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
