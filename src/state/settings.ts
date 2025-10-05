/**
 * @module settings
 * @since 1.0.0
 * @description Manages application settings using Zustand with persistent storage
 */

import { produceWithPatches } from "immer"
import type { StateCreator } from "zustand"

import { getAppDataDir } from "@/bindings/knurl"
import { runTasks } from "@/lib"
import { createStorage, type MigrateContext } from "@/state/middleware/storage"
import {
  type ApplicationState,
  type Settings,
  type SettingsApi,
  type SettingsSlice,
  type Theme,
  type ThemeSource,
  zSettings,
} from "@/types"
import type { StorageProvider } from "@/types/middleware/storage-manager"

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
  version: 1,
  schema: zSettings,
  migrate: async (context: MigrateContext) => {
    const content = (context.content as Partial<Settings>) ?? {}
    // Add migration logic here
    //
    // Example:
    // if (context.version < 2) {
    //   // Migrate from version 1 to 2
    // }
    // if (context.version < 3) {
    //   // Migrate from version 2 to 3
    // }

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
  ApplicationState,
  [["storageManager", never], ["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  SettingsSlice
> = (set, get, storeApi) => {
  // Hookup load/save
  const storageProvider: StorageProvider<Settings> = {
    key: "settings",
    selector: (app) => app.settingsState,
    throttleWait: 2000,
    shouldSave: (prev, current) => prev !== current,
    load: async () => {
      const tasks = await runTasks([SettingsStorage.load(SettingsFileName), getAppDataDir()])

      const settings = tasks[0]
      if (settings) {
        set((app) => {
          app.settingsState = settings
          // Though this may be stored, we always overwrite it
          app.settingsState.data.appDataDir = tasks[1]
        })

        // Subscribe to theme changes to apply them to the DOM automatically.
        // This ensures that theme updates from any source (UI action, proxy update)
        // are always reflected visually.
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
    },
    save: async () => {
      return SettingsStorage.save(SettingsFileName, get().settingsState)
    },
  }
  storeApi.registerStorageProvider(storageProvider)

  /**
   * A wrapper for `set` that generates and broadcasts patches for state changes.
   * This keeps the state update logic DRY and ensures patches are always sent.
   * @param recipe A standard Immer recipe function.
   */
  const setAndSync = (recipe: (draft: ApplicationState) => void) => {
    // 1. Generate the next state and patches in a single, efficient operation.
    const [nextState, _patches] = produceWithPatches(get(), recipe)

    // 2. Pass the fully resolved `nextState` object directly to `set`.
    // The Immer middleware is smart enough to see it's not a function (recipe)
    // and will bypass its own `produce` call, preventing redundant work.
    set(nextState)
    // Single-window: no cross-window broadcasting required.
  }

  const settingsApi: SettingsApi = {
    // Appearance
    setTheme(theme: Theme) {
      setAndSync((app) => {
        app.settingsState.appearance.theme = theme
      })
    },
    setFontSize(size: number) {
      setAndSync((app) => {
        app.settingsState.appearance.fontSize = size
      })
    },
    setAutoHighlight(enabled: boolean) {
      setAndSync((app) => {
        app.settingsState.appearance.autoHighlight = enabled
      })
    },
    setCustomTheme(css) {
      setAndSync((app) => {
        app.settingsState.appearance.customTheme = css
      })
    },
    setCustomThemeUrl(url?: string) {
      setAndSync((app) => {
        app.settingsState.appearance.customThemeUrl = url
      })
    },
    setSelectedPresetTheme(themeName?: string) {
      setAndSync((app) => {
        app.settingsState.appearance.selectedPresetTheme = themeName
      })
    },
    setThemeRegistryUrl(url?: string) {
      setAndSync((app) => {
        app.settingsState.appearance.themeRegistryUrl = url
      })
    },
    setThemeSource(source: ThemeSource) {
      setAndSync((app) => {
        app.settingsState.appearance.themeSource = source
      })
    },

    // Requests
    setAutoSaveRequests(seconds: number) {
      setAndSync((app) => {
        app.settingsState.requests.autoSave = Math.max(0, Math.floor(seconds || 0))
      })
    },
    setRequestTimeout(seconds: number) {
      const s = Math.max(1, Math.floor(seconds || 1))
      setAndSync((app) => {
        app.settingsState.requests.timeout = s
      })
    },
    setMaxRedirects(value: number) {
      setAndSync((app) => {
        app.settingsState.requests.maxRedirects = value
      })
    },
    setSslVerify(verify: boolean) {
      setAndSync((app) => {
        app.settingsState.requests.disableSsl = !verify
      })
    },
    setProxyServer(url?: string) {
      setAndSync((app) => {
        app.settingsState.requests.proxyServer = url && url.length > 0 ? url : undefined
      })
    },

    setPreviewMaxBytes(bytes: number) {
      const b = Math.max(1024 * 1024, Math.floor(bytes || 0))
      setAndSync((app) => {
        app.settingsState.requests.previewMaxBytes = b
      })
    },

    // Advanced
    setDevMode(enabled: boolean) {
      setAndSync((app) => {
        app.settingsState.advanced.devMode = enabled
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
    },
    settingsApi,
  }
}
