import { useApplication } from "@/state/application"

/**
 * Reset the global application store to its initial state.
 * Use in tests to avoid state bleed between cases when using the real store.
 */
export function resetApplicationStore(): void {
  const store = useApplication
  store.setState((s) => {
    // collections
    s.collectionsState.index = []
    s.collectionsState.cache = {}

    // request-tabs
    s.requestTabsState.openTabs = {}
    // @ts-expect-error Active tab can be null per slice
    s.requestTabsState.activeTab = null
    s.requestTabsState.orderedTabs = []

    // settings (mirror defaults in createSettingsSlice)
    s.settingsState = {
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
      },
      advanced: {
        devMode: false,
      },
      data: {
        appDataDir: "",
      },
    }

    // sidebar
    s.sidebarState.isCollapsed = true
    s.sidebarState.panelApi = null

    // utility sheets
    s.utilitySheetsState.stack = []
    s.utilitySheetsState.lastDismissed = null

    // credentials cache
    s.credentialsCacheState.cache = {}
    s.credentialsCacheState.key = null
  })
}

/**
 * Convenience helper to run a test with a clean store.
 */
export async function withCleanStore<T>(fn: () => Promise<T> | T): Promise<T> {
  resetApplicationStore()
  const result = await fn()
  resetApplicationStore()
  return result
}
