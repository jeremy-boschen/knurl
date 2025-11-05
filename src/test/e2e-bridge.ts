import { deleteAppData, getAppDataDir, getAuthenticationResult, loadAppData, saveAppData } from "@/bindings/knurl"
import { credentialsCacheApi, useApplication } from "@/state/application"
import type { AuthResult } from "@/state/credentials"
import type { RequestTabId } from "@/types"

type AuthConfig = Parameters<typeof getAuthenticationResult>[0]

export type WorkspaceSnapshot = {
  activeTab: string | null
  openTabs: Array<{
    tabKey: string
    requestId: string
    collectionId: string
    activePanel: RequestTabId
    selectedEnvironmentId: string | null
  }>
  collectionsIndex: Array<{
    id: string
    name: string
    opened: string[]
    order: number | null
  }>
}

export type KnurlE2EBridge = {
  invokeAuth: (
    config: AuthConfig,
    parentRequestId?: string,
  ) => Promise<Awaited<ReturnType<typeof getAuthenticationResult>>>
  getWorkspaceSnapshot: () => WorkspaceSnapshot
  flushStorage: () => Promise<void>
  getAuthCacheEntry: (requestId: string) => Promise<AuthResult | undefined>
  loadAppData: typeof loadAppData
  saveAppData: typeof saveAppData
  deleteAppData: typeof deleteAppData
  getAppDataDir: typeof getAppDataDir
}

declare global {
  interface Window {
    __KNURL_E2E__?: KnurlE2EBridge
  }
}

function buildWorkspaceSnapshot(): WorkspaceSnapshot {
  const state = useApplication.getState()
  const openTabs = Object.values(state.requestTabsState.openTabs).map((tab) => ({
    tabKey: tab.tabId,
    requestId: tab.requestId,
    collectionId: tab.collectionId,
    activePanel: tab.activeTab,
    selectedEnvironmentId: tab.selectedEnvironmentId ?? null,
  }))

  const collectionsIndex = state.collectionsState.index.map((entry) => ({
    id: entry.id,
    name: entry.name,
    opened: entry.opened ? entry.opened.slice() : [],
    order: typeof entry.order === "number" ? entry.order : null,
  }))

  return {
    activeTab: state.requestTabsState.activeTab,
    openTabs,
    collectionsIndex,
  }
}

async function readAuthCacheEntry(requestId: string): Promise<AuthResult | undefined> {
  const api = credentialsCacheApi()
  const cacheKey = api.generateCacheKey(requestId)
  return await api.get(cacheKey)
}

export function installE2EBridge(): void {
  const bridge: KnurlE2EBridge = {
    invokeAuth: async (config: AuthConfig, parentRequestId?: string) => {
      return await getAuthenticationResult(config, parentRequestId)
    },
    getWorkspaceSnapshot: () => buildWorkspaceSnapshot(),
    flushStorage: async () => {
      await useApplication.saveAll()
    },
    getAuthCacheEntry: async (requestId: string) => {
      return await readAuthCacheEntry(requestId)
    },
    loadAppData: async (fileName: string) => await loadAppData(fileName),
    saveAppData: async (fileName: string, data) => {
      await saveAppData(fileName, data)
    },
    deleteAppData: async (fileName: string) => {
      await deleteAppData(fileName)
    },
    getAppDataDir: async () => await getAppDataDir(),
  }

  window.__KNURL_E2E__ = {
    ...(window.__KNURL_E2E__ ?? {}),
    ...bridge,
  }
}
