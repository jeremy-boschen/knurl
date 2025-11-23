/**
 * Integration Bridge Test Helper
 *
 * Provides convenient access to the integration bridge from tests via browser.execute().
 * The bridge is registered on window.__KNURL_INTEGRATION_BRIDGE__ when VITE_INTEGRATION_ENABLED is set.
 */

import type { RequestState, ResponseState } from "@src/types"

/**
 * Execute a request using the full RequestPipeline (same as the Send button)
 *
 * This invokes the complete request lifecycle:
 * 1. Resolve variables (environment substitution)
 * 2. Create auth (authentication injection)
 * 3. Protocol dispatch (HTTP/WebSocket execution)
 *
 * Returns the response from the backend.
 */
export async function executeRequest(request: RequestState, environmentId?: string): Promise<ResponseState> {
  return browser.execute(
    async (req, envId) => {
      const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
      if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
      return bridge.executeRequest(req, envId)
    },
    request,
    environmentId,
  )
}

/**
 * Load app data file for verification
 */
export async function loadAppData(filePath: string): Promise<any> {
  return browser.execute(async (path) => {
    const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
    if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
    return bridge.loadAppData(path)
  }, filePath)
}

/**
 * Save app data file for testing
 */
export async function saveAppData(filePath: string, data: any): Promise<void> {
  return browser.execute(
    async (path, d) => {
      const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
      if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
      return bridge.saveAppData(path, d)
    },
    filePath,
    data,
  )
}

/**
 * Delete app data file for cleanup
 */
export async function deleteAppData(filePath: string): Promise<void> {
  return browser.execute(async (path) => {
    const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
    if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
    return bridge.deleteAppData(path)
  }, filePath)
}

/**
 * Get app data directory path
 */
export async function getAppDataDir(): Promise<string> {
  return browser.execute(async () => {
    const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
    if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
    return bridge.getAppDataDir()
  })
}

/**
 * Get current workspace snapshot (tab state, collections, etc)
 */
export async function getWorkspaceSnapshot(): Promise<any> {
  return browser.execute(async () => {
    const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
    if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
    return bridge.getWorkspaceSnapshot()
  })
}

/**
 * Get collections index (list of all collections)
 */
export async function getCollectionsIndex(): Promise<any[]> {
  return browser.execute(async () => {
    const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
    if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
    return bridge.getCollectionsIndex()
  })
}

/**
 * Get full collection data by ID
 */
export async function getCollection(collectionId: string): Promise<any> {
  return browser.execute(
    async (id) => {
      const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
      if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
      return bridge.getCollection(id)
    },
    collectionId,
  )
}

/**
 * Create a new collection
 */
export async function createCollection(name: string): Promise<string> {
  return browser.execute(
    async (n) => {
      const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
      if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
      return bridge.createCollection(n)
    },
    name,
  )
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string): Promise<void> {
  return browser.execute(
    async (id) => {
      const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
      if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
      return bridge.deleteCollection(id)
    },
    collectionId,
  )
}
