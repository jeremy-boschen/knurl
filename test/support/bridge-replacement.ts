/**
 * Bridge replacement module - provides bridge-like API but uses real UI/filesystem
 *
 * This module serves as a transition path away from the E2E bridge pattern.
 * It provides the same interface as the bridge but uses:
 * - UI interactions for state mutations (create_collection, update_collection, etc.)
 * - Filesystem reads for verification (loadAppData, get_collection, etc.)
 * - Direct app state access for queries (getWorkspaceSnapshot)
 *
 * Eventually, tests should move away from this module too and directly use
 * UI utilities and filesystem functions, but this provides a drop-in replacement
 * for the bridge during the transition period.
 */

import { createCollection } from "./collections"
import { readAppDataJson, readAppDataFile, appDataFileExists, writeAppDataFile, deleteAppDataFile } from "./filesystem"

/**
 * Create a collection and return its data
 */
export async function createCollectionViaUI(params: { name: string }): Promise<any> {
  const collectionId = await createCollection(params.name)

  // Read the created collection from disk to return its data
  try {
    const collectionData = await readAppDataJson(`collections/${collectionId}.json`)
    return {
      id: collectionId,
      ...collectionData,
    }
  } catch {
    // If file doesn't exist yet, return minimal data
    return {
      id: collectionId,
      name: params.name,
    }
  }
}

/**
 * Get workspace snapshot from app state
 */
export async function getWorkspaceSnapshotFromState(): Promise<any> {
  return await browser.execute(() => {
    try {
      const modules = (window as any).__vite_ssr_modules__
      if (!modules) return null

      const appModule = Object.values(modules).find((mod: any) => {
        return mod && mod.useApplication && typeof mod.useApplication === 'function'
      }) as any

      if (!appModule?.useApplication) return null

      const state = appModule.useApplication.getState()
      const openTabs = Object.values(state.requestTabsState?.openTabs ?? {}).map((tab: any) => ({
        tabKey: tab.tabId,
        requestId: tab.requestId,
        collectionId: tab.collectionId,
        activePanel: tab.activeTab,
        selectedEnvironmentId: tab.selectedEnvironmentId ?? null,
      }))

      const collectionsIndex = state.collectionsState?.index?.map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        opened: entry.opened ? entry.opened.slice() : [],
        order: typeof entry.order === 'number' ? entry.order : null,
      })) ?? []

      return {
        activeTab: state.requestTabsState?.activeTab ?? null,
        openTabs,
        collectionsIndex,
      }
    } catch {
      return null
    }
  })
}

/**
 * Get collection data from filesystem
 */
export async function getCollectionFromDisk(params: { id: string }): Promise<any> {
  const filePath = `collections/${params.id}.json`
  const exists = await appDataFileExists(filePath)

  if (!exists) {
    throw new Error(`Collection not found: ${params.id}`)
  }

  return await readAppDataJson(filePath)
}

/**
 * Load app data file as-is (binary or text)
 */
export async function loadAppDataFile(filePath: string): Promise<any> {
  return await readAppDataFile(filePath)
}

/**
 * Flush storage by triggering a save in the app
 */
export async function flushStorageViaApp(): Promise<void> {
  await browser.executeAsync(async (done: () => void) => {
    try {
      const modules = (window as any).__vite_ssr_modules__
      if (!modules) {
        done()
        return
      }

      const appModule = Object.values(modules).find((mod: any) => {
        return mod && mod.useApplication && typeof mod.useApplication === 'function'
      }) as any

      if (appModule?.useApplication) {
        await appModule.useApplication.getState().saveAll?.()
      }
      done()
    } catch {
      done()
    }
  })
}

/**
 * Get app data directory path from Tauri
 */
export async function getAppDataDirFromTauri(): Promise<string> {
  return await browser.executeAsync(async (done: (result: string) => void) => {
    try {
      // Access Tauri API to get app data directory
      const { appDataDir } = await (window as any).__TAURI__.path
      const dir = await appDataDir()
      done(dir)
    } catch (error) {
      done('')
    }
  })
}

/**
 * Get auth cache entry for a request
 */
export async function getAuthCacheEntryFromState(requestId: string): Promise<any> {
  return await browser.execute((reqId: string) => {
    try {
      const modules = (window as any).__vite_ssr_modules__
      if (!modules) return undefined

      const appModule = Object.values(modules).find((mod: any) => {
        return mod && mod.useApplication && typeof mod.useApplication === 'function'
      }) as any

      if (!appModule?.useApplication) return undefined

      const state = appModule.useApplication.getState()
      return state.credentialsState?.cache?.[reqId]
    } catch {
      return undefined
    }
  }, requestId)
}

/**
 * Get all collections from app state
 */
export async function getAllCollectionsFromState(): Promise<any[]> {
  return await browser.execute(() => {
    try {
      const modules = (window as any).__vite_ssr_modules__
      if (!modules) return []

      const appModule = Object.values(modules).find((mod: any) => {
        return mod && mod.useApplication && typeof mod.useApplication === 'function'
      }) as any

      if (!appModule?.useApplication) return []

      const state = appModule.useApplication.getState()
      return state.collectionsState?.index ?? []
    } catch {
      return []
    }
  })
}

/**
 * Update collection via app state
 */
export async function updateCollectionViaState(params: { id: string; name?: string; [key: string]: any }): Promise<any> {
  await browser.executeAsync(async (params: any, done: () => void) => {
    try {
      const modules = (window as any).__vite_ssr_modules__
      if (!modules) {
        done()
        return
      }

      const appModule = Object.values(modules).find((mod: any) => {
        return mod && mod.useApplication && typeof mod.useApplication === 'function'
      }) as any

      if (!appModule?.useApplication) {
        done()
        return
      }

      const state = appModule.useApplication.getState()
      const api = state.collectionsApi?.()

      if (api?.update) {
        api.update(params.id, params)
      }
      done()
    } catch {
      done()
    }
  }, params)

  // Return the updated collection from disk
  try {
    return await readAppDataJson(`collections/${params.id}.json`)
  } catch {
    return { id: params.id, ...params }
  }
}

/**
 * Delete collection via app state
 */
export async function deleteCollectionViaState(params: { id: string }): Promise<void> {
  await browser.executeAsync(async (id: string, done: () => void) => {
    try {
      const modules = (window as any).__vite_ssr_modules__
      if (!modules) {
        done()
        return
      }

      const appModule = Object.values(modules).find((mod: any) => {
        return mod && mod.useApplication && typeof mod.useApplication === 'function'
      }) as any

      if (!appModule?.useApplication) {
        done()
        return
      }

      const state = appModule.useApplication.getState()
      const api = state.collectionsApi?.()

      if (api?.remove) {
        api.remove(id)
      }
      done()
    } catch {
      done()
    }
  }, params.id)
}

/**
 * Invoke auth via Tauri backend
 */
export async function invokeAuthViaTauri(authConfig: any, requestId?: string): Promise<any> {
  return await browser.executeAsync(async (config: any, reqId: string | undefined, done: (result: any) => void) => {
    try {
      const { invoke } = await (window as any).__TAURI__.core
      const result = await invoke('get_authentication_result', {
        config,
        parentRequestId: reqId
      })
      done({ ok: true, result })
    } catch (error: any) {
      done({ ok: false, error: error.message || String(error) })
    }
  }, authConfig, requestId)
}

/**
 * Replacement for callBridge that routes to appropriate implementation
 */
export async function callBridgeReplacement(
  method: string,
  ...args: any[]
): Promise<any> {
  switch (method) {
    case 'create_collection':
      return await createCollectionViaUI(args[0])

    case 'get_collection':
      return await getCollectionFromDisk(args[0])

    case 'getWorkspaceSnapshot':
    case 'get_workspace_snapshot':
      return await getWorkspaceSnapshotFromState()

    case 'loadAppData':
    case 'load_app_data':
      return await loadAppDataFile(args[0])

    case 'flushStorage':
    case 'flush_storage':
      return await flushStorageViaApp()

    case 'getAppDataDir':
    case 'get_app_data_dir':
      return await getAppDataDirFromTauri()

    case 'saveAppData':
    case 'save_app_data':
      return await writeAppDataFile(args[0], args[1])

    case 'deleteAppData':
    case 'delete_app_data':
      return await deleteAppDataFile(args[0])

    case 'getAuthCacheEntry':
    case 'get_auth_cache_entry':
      return await getAuthCacheEntryFromState(args[0])

    case 'get_all_collections':
    case 'getAllCollections':
      return await getAllCollectionsFromState()

    case 'update_collection':
    case 'updateCollection':
      return await updateCollectionViaState(args[0])

    case 'delete_collection':
    case 'deleteCollection':
      return await deleteCollectionViaState(args[0])

    case 'invoke_auth':
    case 'invokeAuth':
      return await invokeAuthViaTauri(args[0], args[1])

    default:
      throw new Error(`Bridge replacement not implemented for method: ${method}`)
  }
}
