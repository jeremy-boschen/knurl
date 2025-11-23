/**
 * Integration Test Bridge
 *
 * This module exports a bridge API object that is registered on window for test access.
 * It provides test-only access to backend functionality without mocking, using real
 * Tauri commands and app state.
 *
 * The bridge is conditionally bundled (dev mode or E2E flag) and made available as:
 *   window.__KNURL_INTEGRATION_BRIDGE__
 *
 * Tests access it via:
 *   await browser.execute(() => window.__KNURL_INTEGRATION_BRIDGE__.sendRequest(...))
 */

import { sendHttpRequest, loadAppData, saveAppData, deleteAppData, getAppDataDir } from "@/bindings/knurl"
import { useApplication, collectionsApi } from "@/state/application"
import type { Request, Response } from "@/bindings/knurl"

/**
 * Integration Bridge API - all methods available to tests
 */
export const integrationBridge = {
  /**
   * Send HTTP request via Tauri backend
   */
  async sendRequest(request: Request): Promise<Response> {
    return sendHttpRequest(request)
  },

  /**
   * Load app data file (for verification)
   */
  async loadAppData(filePath: string): Promise<any> {
    return loadAppData(filePath)
  },

  /**
   * Save app data file (for testing)
   */
  async saveAppData(filePath: string, data: any): Promise<void> {
    return saveAppData(filePath, data)
  },

  /**
   * Delete app data file (for cleanup)
   */
  async deleteAppData(filePath: string): Promise<void> {
    return deleteAppData(filePath)
  },

  /**
   * Get app data directory
   */
  async getAppDataDir(): Promise<string> {
    return getAppDataDir()
  },

  /**
   * Get current workspace snapshot from Zustand state
   */
  async getWorkspaceSnapshot(): Promise<any> {
    const state = useApplication.getState()
    return {
      activeRequestTab: state.requestTabsState?.activeRequestTabId,
      openTabs: state.requestTabsState?.requestTabs || [],
      collectionsIndex: state.collectionsState?.index || [],
    }
  },

  /**
   * Get collections index (list of all collections)
   */
  async getCollectionsIndex(): Promise<any[]> {
    const state = useApplication.getState()
    return state.collectionsState?.index || []
  },

  /**
   * Get full collection data by ID
   */
  async getCollection(collectionId: string): Promise<any> {
    const state = useApplication.getState()
    return state.collectionsState?.collections?.[collectionId]
  },

  /**
   * Add a new collection to state
   */
  async createCollection(name: string): Promise<string> {
    const api = collectionsApi()
    if (!api || !api.add) {
      throw new Error("Collections API not available")
    }
    const collectionId = api.add(name)
    return collectionId
  },

  /**
   * Delete a collection
   */
  async deleteCollection(collectionId: string): Promise<void> {
    const api = collectionsApi()
    if (!api || !api.remove) {
      throw new Error("Collections API not available")
    }
    api.remove(collectionId)
  },
}

// Register on window for test access (only when VITE_INTEGRATION_ENABLED is set)
if (import.meta.env.VITE_INTEGRATION_ENABLED) {
  ;(window as any).__KNURL_INTEGRATION_BRIDGE__ = integrationBridge
}
