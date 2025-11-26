import { beforeEach, describe, expect, it, vi } from "vitest"
import { createStore } from "zustand/vanilla"
import { subscribeWithSelector } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

import { createSettingsSlice } from "@/state/settings"
import type { Settings, SettingsSlice } from "@/types"
import type { StorageProvider } from "@/types/middleware/storage-manager"
import type { StoreApi } from "zustand"

type LoadSettingsFn = (fileName: string) => Promise<Settings | null>
type SaveSettingsFn = (fileName: string, data: Settings) => Promise<void>
type DeleteSettingsFn = (fileName: string) => Promise<void>
type GetAppDataDirFn = () => Promise<string>

const mockSettingsStorage = vi.hoisted(() => ({
  load: vi.fn<LoadSettingsFn>(async () => null),
  save: vi.fn<SaveSettingsFn>(async () => {}),
  delete: vi.fn<DeleteSettingsFn>(async () => {}),
})) as {
  load: ReturnType<typeof vi.fn<LoadSettingsFn>>
  save: ReturnType<typeof vi.fn<SaveSettingsFn>>
  delete: ReturnType<typeof vi.fn<DeleteSettingsFn>>
}

const mockGetAppDataDir = vi.hoisted(() => vi.fn<GetAppDataDirFn>(async () => "/mock/app-data")) as ReturnType<
  typeof vi.fn<GetAppDataDirFn>
>

vi.mock("@/state/middleware/storage", async () => {
  const actual = await vi.importActual<typeof import("@/state/middleware/storage")>(
    "@/state/middleware/storage",
  )
  return {
    ...actual,
    createStorage: vi.fn(() => mockSettingsStorage),
  }
})

vi.mock("@/bindings/knurl", () => ({
  getAppDataDir: mockGetAppDataDir,
}))

type RegisterableStore = StoreApi<SettingsSlice> & {
  storageProvider: StorageProvider<Settings>
}

const buildSettingsStore = (): RegisterableStore => {
  let capturedProvider: StorageProvider<Settings> | null = null

  const initializer = (set: StoreApi<SettingsSlice>["setState"], get: StoreApi<SettingsSlice>["getState"], api: StoreApi<SettingsSlice>) => {
    ;(api as StoreApi<SettingsSlice> & { registerStorageProvider: (provider: StorageProvider<Settings>) => void }).registerStorageProvider = (
      provider,
    ) => {
      capturedProvider = provider
    }

    return createSettingsSlice(set as any, get as any, api as any)
  }

  const store = createStore<SettingsSlice>()(immer(subscribeWithSelector(initializer as any))) as StoreApi<SettingsSlice>

  if (!capturedProvider) {
    throw new Error("settings storage provider was not registered")
  }

  return Object.assign(store, { storageProvider: capturedProvider })
}

const hydrateStore = async (store: RegisterableStore) => {
  await store.storageProvider.load()
}

const resetDom = () => {
  const root = document.documentElement
  root.className = ""
  root.removeAttribute("data-theme")
  root.style.removeProperty("--font-size-root")
  document.getElementById("custom-theme-vars")?.remove()
}

const mockMatchMedia = (matchesDark: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => ({
      matches: matchesDark,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  })
}

describe("settings slice", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsStorage.load.mockResolvedValue(null)
    mockSettingsStorage.save.mockResolvedValue()
    mockSettingsStorage.delete.mockResolvedValue()
    mockGetAppDataDir.mockResolvedValue("/mock/app-data")
    resetDom()
    mockMatchMedia(false)
  })

  it("hydrates defaults and persists when no stored file is present", async () => {
    const store = buildSettingsStore()

    await hydrateStore(store)

    const state = store.getState().settingsState
    expect(mockSettingsStorage.load).toHaveBeenCalledWith("settings.json")
    expect(state.data.appDataDir).toBe("/mock/app-data")
    expect(mockSettingsStorage.save).toHaveBeenCalledWith("settings.json", state)
    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    expect(document.documentElement.style.getPropertyValue("--font-size-root")).toBe("16px")
  })

  it("applies appearance side-effects through subscriptions", async () => {
    const store = buildSettingsStore()
    await hydrateStore(store)

    const { settingsApi } = store.getState()
    const root = document.documentElement

    settingsApi.setTheme("dark")
    expect(root.classList.contains("dark")).toBe(true)
    expect(root.getAttribute("data-theme")).toBe("dark")

    mockMatchMedia(true)
    settingsApi.setTheme("system")
    expect(root.getAttribute("data-theme")).toBe("dark")

    settingsApi.setFontSize(25.7)
    expect(root.style.getPropertyValue("--font-size-root")).toBe("24px")
    settingsApi.setFontSize(2)
    expect(root.style.getPropertyValue("--font-size-root")).toBe("10px")

    settingsApi.setCustomTheme(":root { --brand: #ff0; }")
    expect(document.getElementById("custom-theme-vars")?.textContent).toContain("--brand")
    settingsApi.setCustomTheme("   ")
    expect(document.getElementById("custom-theme-vars")).toBeNull()
  })

  it("clamps request + advanced settings to safe ranges", async () => {
    const store = buildSettingsStore()
    await hydrateStore(store)
    const { settingsApi } = store.getState()

    settingsApi.setAutoSaveRequests(-5)
    settingsApi.setAutoSaveRequests(12.7)
    expect(store.getState().settingsState.requests.autoSave).toBe(12)

    settingsApi.setRequestTimeout(0)
    settingsApi.setRequestTimeout(9.9)
    expect(store.getState().settingsState.requests.timeout).toBe(9)

    settingsApi.setPreviewMaxBytes(512)
    expect(store.getState().settingsState.requests.previewMaxBytes).toBe(1024 * 1024)
    settingsApi.setPreviewMaxBytes(5 * 1024 * 1024 + 123)
    expect(store.getState().settingsState.requests.previewMaxBytes).toBe(5 * 1024 * 1024 + 123)

    settingsApi.setProxyServer("")
    expect(store.getState().settingsState.requests.proxyServer).toBeUndefined()
    settingsApi.setProxyServer("http://localhost:8899")
    expect(store.getState().settingsState.requests.proxyServer).toBe("http://localhost:8899")

    settingsApi.setSslVerify(false)
    expect(store.getState().settingsState.requests.disableSsl).toBe(true)

    settingsApi.setMaxRedirects(4)
    expect(store.getState().settingsState.requests.maxRedirects).toBe(4)

    settingsApi.setDevMode(true)
    expect(store.getState().settingsState.advanced.devMode).toBe(true)
  })
})
