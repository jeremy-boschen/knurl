import { z } from "zod"

export const zTheme = z.enum(["dark", "light", "system"])
export type Theme = z.infer<typeof zTheme>

export const zThemeSource = z.enum(["default", "preset", "custom"])
export type ThemeSource = z.infer<typeof zThemeSource>

/**
 * shadcn registry cssVars schema
 */
export const zCssVarsMap = z.record(z.string(), z.string())
export const zCssVarsSchema = z.object({
  theme: zCssVarsMap.prefault({}),
  light: zCssVarsMap.prefault({}),
  dark: zCssVarsMap.prefault({}),
})
export const zCustomTheme = z.object({
  cssVars: zCssVarsSchema,
})
export type CustomTheme = z.infer<typeof zCustomTheme>

/**
 * Appearance settings
 */
export const zAppearanceSettings = z.object({
  // global font size
  fontSize: z.number(),
  // whether to automatically highlight syntax
  autoHighlight: z.boolean(),
  // application theme (light, dark, system)
  theme: zTheme,
  // optional custom theme as a raw CSS string
  customTheme: z.string().optional(),
  // optional shadcn theme url used to populate customTheme
  customThemeUrl: z.string().optional(),
  // name of the selected preset theme, if any
  selectedPresetTheme: z.string().optional(),
  // URL for the theme registry for preset themes
  themeRegistryUrl: z.string().optional(),
  // how the theme is currently sourced in the UI
  themeSource: zThemeSource.optional().default("default"),
})

/**
 * Request and network behavior
 */
export const zRequestSettings = z.object({
  // auto save requests after N seconds. 0 disables
  autoSave: z.number().int().min(0),
  // request timeout in seconds
  timeout: z.number().int().positive(),
  // follow HTTP redirects automatically
  maxRedirects: z.number().int().min(0),
  // if true, SSL certificate verification is disabled
  disableSsl: z.boolean(),
  // optional proxy server URL
  proxyServer: z.string().optional(),
  // maximum bytes to generate base64 previews for binary responses
  previewMaxBytes: z.number().int().positive().optional(),
})

/**
 * Advanced/developer settings
 */
export const zAdvancedSettings = z.object({
  // enable developer mode features and console
  devMode: z.boolean(),
})

export const zDataSettings = z.object({
  appDataDir: z.string().readonly(),
})

export const zSettings = z.object({
  appearance: zAppearanceSettings,
  requests: zRequestSettings,
  advanced: zAdvancedSettings,
  data: zDataSettings,
})
export type Settings = z.infer<typeof zSettings>

/**
 * Interface for application settings mutations
 */
export interface SettingsApi {
  // Appearance
  setTheme(theme: Theme): void
  setFontSize(size: number): void
  setAutoHighlight(enabled: boolean): void
  setCustomTheme(css?: string): void
  setCustomThemeUrl(url?: string): void
  setSelectedPresetTheme(themeName?: string): void
  setThemeRegistryUrl(url?: string): void
  setThemeSource(source: ThemeSource): void

  // Requests
  setAutoSaveRequests(seconds: number): void
  setRequestTimeout(seconds: number): void
  setMaxRedirects(value: number): void
  setSslVerify(verify: boolean): void
  setProxyServer(url?: string): void
  setPreviewMaxBytes(bytes: number): void

  // Advanced
  setDevMode(enabled: boolean): void
}

export interface SettingsSlice {
  settingsState: Settings
  settingsApi: SettingsApi
}
