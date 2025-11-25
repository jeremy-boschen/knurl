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
 *   await browser.execute(() => window.__KNURL_INTEGRATION_BRIDGE__.executeRequest(...))
 */

import { loadAppData, saveAppData, deleteAppData, getAppDataDir } from "@/bindings/knurl"
import { useApplication, collectionsApi } from "@/state/application"
import {
  runPipeline,
  resolveVariablesPhase,
  createAuthPhase,
  protocolDispatchPhase,
  type RequestContext,
  type PipelineNotifier,
} from "@/request/pipeline"
import { generateUniqueId } from "@/lib/utils"
import type { ResponseState, RequestState } from "@/types"

/**
 * Integration Bridge API - all methods available to tests
 */
export const integrationBridge = {
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
  async executeRequest(request: RequestState, environmentId?: string): Promise<ResponseState> {
    return new Promise((resolve, reject) => {
      const get = useApplication.getState
      const set = useApplication.setState
      const state = get()
      const environment = environmentId
        ? state.environmentsState?.environments?.[environmentId]
        : state.environmentsState?.environments?.[state.environmentsState?.selectedEnvironmentId]

      const correlationId = generateUniqueId()
      const initialContext: RequestContext = {
        request,
        environment,
        response: {},
        correlationId,
      }

      // Only include auth phase if the request has authentication configured
      const phases: (typeof resolveVariablesPhase)[] = [resolveVariablesPhase]

      if (request.authentication.type !== "none" && request.authentication.type !== "inherit") {
        const authPhase = createAuthPhase(get, set)
        phases.push(authPhase)
      }

      phases.push(protocolDispatchPhase)

      const notifier: PipelineNotifier = {
        onStart: () => {},
        onSuccess: (response: ResponseState) => {
          resolve(response)
        },
        onError: (error: Error) => {
          reject(error)
        },
        onLog: () => {},
      }

      runPipeline(phases, initialContext, notifier).catch(reject)
    })
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
