/**
 * @module settings
 * @since 1.0.0
 * @description Manages application settings using Zustand with persistent storage
 */

import type { StateCreator } from "zustand"

import { getAppDataDir } from "@/bindings/knurl"
import { runTasks } from "@/lib"
import { createStorage, type MigrateContext } from "@/state/middleware/storage"
import {
  type Application,
  type Settings,
  type SettingsApi,
  type SettingsSlice,
  type Theme,
  type ThemeSource,
  type WindowState,
  zSettings,
} from "@/types"
import type { StorageProvider } from "@/types/middleware/storage-manager"

import { getSyncLogger } from "@/lib/logger"

const logger = getSyncLogger("state/settings")

const applyTheme = (theme: Theme): void => {
  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  const root = window.document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.setAttribute("data-theme", theme)
}

const CUSTOM_THEME_STYLE_ID = "custom-theme-vars"

/**
 * Apply or clear custom theme CSS in a dedicated <style> tag
 */
const applyCustomTheme = (customThemeCss: string | undefined) => {
  const head = document.head
  let el = document.getElementById(CUSTOM_THEME_STYLE_ID) as HTMLStyleElement | null

  // If the CSS is empty or undefined, remove the style tag.
  if (!customThemeCss?.trim()) {
    if (el) {
      el.remove()
    }
    return
  }

  if (!el) {
    el = document.createElement("style")
    el.id = CUSTOM_THEME_STYLE_ID
    head.appendChild(el)
  }
  el.textContent = customThemeCss
}

/**
 * Apply base font size to the root so rem-based sizing scales globally.
 */
const applyFontSize = (sizePx: number): void => {
  const root = window.document.documentElement
  const px = Math.max(10, Math.min(24, Math.floor(sizePx || 16)))
  root.style.setProperty("--font-size-root", `${px}px`)
}

const SettingsStorage = createStorage<Settings>({
  version: 2,
  schema: zSettings,
  migrate: async (context: MigrateContext) => {
    const content = (context.content as Partial<Settings>) ?? {}

    if (context.version < 2) {
      // Add windows map with no entries
      ;(content as Partial<Settings> & { windows?: Record<string, unknown> }).windows ??= {}
    }

    return content as Settings
  },
})

const SettingsFileName = "settings.json"

/**
 * Zustand store for managing application settings
 * @param set
 * @param get
 * @param storeApi - Zustand's fully built StoreApi with middlewares
 * @returns Persisted state object with settings management operations
 */
export const createSettingsSlice: StateCreator<
  Application,
  [["storageManager", never], ["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  SettingsSlice
> = (set, get, storeApi) => {
  // Hookup load/save
  let subscriptionsRegistered = false
  const registerSubscriptions = () => {
    if (subscriptionsRegistered) {
      return
    }
    subscriptionsRegistered = true

    storeApi.subscribe(
      (state) => state.settingsState.appearance.theme,
      (theme) => applyTheme(theme),
      { fireImmediately: true },
    )

    storeApi.subscribe(
      (state) => state.settingsState.appearance.customTheme,
      (customTheme) => applyCustomTheme(customTheme),
      { fireImmediately: true },
    )

    storeApi.subscribe(
      (state) => state.settingsState.appearance.fontSize,
      (size) => applyFontSize(size),
      { fireImmediately: true },
    )
  }

  const storageProvider: StorageProvider<Settings> = {
    key: "settings",
    selector: (app) => app.settingsState,
    throttleWait: 2000,
    shouldSave: (prev, current) => prev !== current,
    load: async () => {
      const tasks = await runTasks([SettingsStorage.load(SettingsFileName), getAppDataDir()])

      const settings = tasks[0]
      const appDataDir = tasks[1]

      set((app) => {
        if (settings) {
          app.settingsState = settings
        }
        app.settingsState.data.appDataDir = appDataDir
      })

      registerSubscriptions()

      if (!settings) {
        try {
          await SettingsStorage.save(SettingsFileName, get().settingsState)
        } catch (error) {
          logger.error("settings: failed to persist default settings", { error })
        }
      }
    },
    save: async () => {
      return SettingsStorage.save(SettingsFileName, get().settingsState)
    },
  }
  storeApi.registerStorageProvider(storageProvider)

  const settingsApi: SettingsApi = {
    // Appearance
    setTheme(theme: Theme) {
      set((app) => {
        app.settingsState.appearance.theme = theme
      })
    },
    setFontSize(size: number) {
      set((app) => {
        app.settingsState.appearance.fontSize = size
      })
    },
    setAutoHighlight(enabled: boolean) {
      set((app) => {
        app.settingsState.appearance.autoHighlight = enabled
      })
    },
    setCustomTheme(css) {
      set((app) => {
        app.settingsState.appearance.customTheme = css
      })
    },
    setCustomThemeUrl(url?: string) {
      set((app) => {
        app.settingsState.appearance.customThemeUrl = url
      })
    },
    setSelectedPresetTheme(themeName?: string) {
      set((app) => {
        app.settingsState.appearance.selectedPresetTheme = themeName
      })
    },
    setThemeRegistryUrl(url?: string) {
      set((app) => {
        app.settingsState.appearance.themeRegistryUrl = url
      })
    },
    setThemeSource(source: ThemeSource) {
      set((app) => {
        app.settingsState.appearance.themeSource = source
      })
    },

    // Requests
    setAutoSaveRequests(seconds: number) {
      set((app) => {
        app.settingsState.requests.autoSave = Math.max(0, Math.floor(seconds || 0))
      })
    },
    setRequestTimeout(seconds: number) {
      const s = Math.max(1, Math.floor(seconds || 1))
      set((app) => {
        app.settingsState.requests.timeout = s
      })
    },
    setMaxRedirects(value: number) {
      set((app) => {
        app.settingsState.requests.maxRedirects = value
      })
    },
    setSslVerify(verify: boolean) {
      set((app) => {
        app.settingsState.requests.disableSsl = !verify
      })
    },
    setProxyServer(url?: string) {
      set((app) => {
        app.settingsState.requests.proxyServer = url && url.length > 0 ? url : undefined
      })
    },

    setPreviewMaxBytes(bytes: number) {
      const b = Math.max(1024 * 1024, Math.floor(bytes || 0))
      set((app) => {
        app.settingsState.requests.previewMaxBytes = b
      })
    },

    // Advanced
    setDevMode(enabled: boolean) {
      set((app) => {
        app.settingsState.advanced.devMode = enabled
      })
    },

    setWindowState(windowName: string, state: WindowState) {
      set((app) => {
        app.settingsState.windows[windowName] = state
      })
    },
  }

  return {
    settingsState: {
      appearance: {
        fontSize: 16,
        theme: "system",
        autoHighlight: true,
        customTheme: undefined,
        customThemeUrl: undefined,
        selectedPresetTheme: undefined,
        themeRegistryUrl: undefined,
        themeSource: "default",
      },
      requests: {
        autoSave: 30,
        timeout: 30,
        maxRedirects: 1,
        disableSsl: false,
        proxyServer: undefined,
        previewMaxBytes: 20 * 1024 * 1024,
      },
      advanced: {
        devMode: false,
      },
      data: {
        appDataDir: "",
      },
      windows: {},
    },
    settingsApi,
  }
}
