/**
 * Integration Bridge Test Helper
 *
 * Provides convenient access to the integration bridge from tests via browser.execute().
 * The bridge is registered on window.__KNURL_INTEGRATION_BRIDGE__ when VITE_INTEGRATION_ENABLED is set.
 */

import type { Request, Response } from "@src/bindings/knurl"

/**
 * Send an HTTP request via the backend (Tauri + Rust HTTP engine)
 */
export async function sendRequest(request: Request): Promise<Response> {
  return browser.execute(
    async (req) => {
      const bridge = (window as any).__KNURL_INTEGRATION_BRIDGE__
      if (!bridge) throw new Error("Integration bridge not available. Is VITE_INTEGRATION_ENABLED set?")
      return bridge.sendRequest(req)
    },
    request,
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
