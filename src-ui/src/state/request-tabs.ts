import { listen } from "@tauri-apps/api/event"
import { merge } from "es-toolkit"
import type { StateCreator, StoreApi } from "zustand"

import type { AppError } from "@/bindings/knurl"
import { cancelHttpRequest, deleteFile, getAuthenticationResult } from "@/bindings/knurl"
import { assert, isNotEmpty, nonNull } from "@/lib"
import { eventBus } from "@/lib/event-emitter"
import { resolveRequestVariables } from "@/lib/environments"
import { generateUniqueId } from "@/lib/utils"
import {
  createAuthPhase,
  type PipelineNotifier,
  protocolDispatchPhase,
  type RequestContext,
  type RequestPhase,
  resolveVariablesPhase,
  runPipeline,
} from "@/request/pipeline"
import { isScratchCollection, saveScratchRequest, ScratchCollectionId } from "@/state/collections"
import {
  type Application,
  DEFAULT_LOG_LEVELS,
  type LogEntry,
  type RequestState,
  type RequestTabsApi,
  type RequestTabsSlice,
  type RequestTabState,
  type ResponseState,
  toMergedRequest,
  zRequestTabState,
} from "@/types"

// Helper function to escape special regex characters
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\\]/g, "\\$&")
}

const requireLoadedCollection = (state: Application, collectionId: string) => {
  const collection = state.collectionsState.cache[collectionId]
  assert(collection, `Request tabs expected collection ${collectionId} to be loaded`)
  return collection
}

export const requestTabsSliceCreator: StateCreator<
  Application,
  [["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  RequestTabsSlice
> = (set, get, storeApi: StoreApi<Application>) => {
  // One-time restore guard to rebuild tabs from collection index `opened` lists
  let restoredFromIndex = false
  // Helper function to update merged request in tab state
  const updateMergedRequest = (tabId: string) => {
    set((app) => {
      const tab = app.requestTabsState.openTabs[tabId]
      if (!tab) {
        return
      }

      const collection = requireLoadedCollection(app, tab.collectionId)
      const request = collection.requests[tab.requestId]
      if (request) {
        tab.merged = toMergedRequest(request)
      }
    })
  }

  const recomputeOrderedTabs = (state: RequestTabsSlice["requestTabsState"]) => {
    state.orderedTabs = Object.values(state.openTabs).sort((a, b) => a.order - b.order)
  }

  const requestTabsApi: RequestTabsApi = {
    getOpenTabs(): RequestTabState[] {
      return Object.values(get().requestTabsState.openTabs)
    },

    getOpenTab(collectionId: string, requestId: string) {
      return (
        Object.values(get().requestTabsState.openTabs).find(
          (t) => t.collectionId === collectionId && t.requestId === requestId,
        ) ?? null
      )
    },

    getActiveTab(): RequestTabState | null {
      const state = get().requestTabsState
      if (!state.activeTab) {
        return null
      }
      return nonNull(state.openTabs[state.activeTab], `Expected activeTab:${state.activeTab} to exist in openTabs`)
    },

    setActiveTab(tabId: string) {
      set((app) => {
        if (tabId in app.requestTabsState.openTabs) {
          app.requestTabsState.activeTab = tabId
        }
      })
    },

    async loadTab(collectionId: string, requestId: string) {
      const collection = await storeApi.getState().collectionsApi.loadCollection(collectionId)
      const request = collection.requests[requestId]
      assert(request, `loadTab called with unknown requestId:${requestId} for collection:${collectionId}`)
      return request
    },

    createRequestTab(collectionId?: string, request?: Partial<RequestState>) {
      const basePayload = {
        name: "Untitled Request",
      }
      const payload = request ? merge(basePayload, request) : basePayload

      const newRequest = storeApi.getState().collectionsApi.createRequest(collectionId ?? ScratchCollectionId, payload)

      requestTabsApi.openRequestTab(newRequest.collectionId, newRequest.id)
    },

    openRequestTab(collectionId: string, requestId: string) {
      const state = get()
      const collection = requireLoadedCollection(state, collectionId)
      assert(collection.requests[requestId], `openRequestTab called with unknown requestId:${requestId}`)

      const openTabs = state.requestTabsState.openTabs

      const openTab = Object.values(openTabs).find((t) => t.collectionId === collectionId && t.requestId === requestId)
      if (openTab) {
        set((app) => {
          app.requestTabsState.activeTab = openTab.tabId
          //marker:collectionState.index update
          const index = app.collectionsState.index.find((m) => m.id === collectionId)
          if (index) {
            index.open = true
          }
        })

        return
      }

      const newTab = zRequestTabState.parse({
        tabId: generateUniqueId(),
        order: Object.values(openTabs).length,
        collectionId,
        requestId,
      })

      set((app) => {
        app.requestTabsState.openTabs[newTab.tabId] = newTab
        app.requestTabsState.activeTab = newTab.tabId

        // Update collections index to track opened requests for this collection
        const idx = app.collectionsState.index.find((m) => m.id === collectionId)
        if (idx) {
          const opened = new Set(idx.opened ?? [])
          opened.add(requestId)
          idx.opened = Array.from(opened)
        }

        recomputeOrderedTabs(app.requestTabsState)
      })

      // Emit event after tab is created
      eventBus.emit({
        type: "requestUi",
        action: "opened",
        tabId: newTab.tabId,
        requestId: newTab.requestId,
        collectionId: newTab.collectionId,
        timestamp: new Date().toISOString(),
      })

      updateMergedRequest(newTab.tabId)
    },

    updateTab(tabId: string, update: Partial<RequestTabState>) {
      set((app) => {
        const state = app.requestTabsState
        const openTab = state.openTabs[tabId]

        // Guard against tab being closed
        if (openTab) {
          merge(openTab, update)
          if (Object.hasOwn(update, "order")) {
            recomputeOrderedTabs(state)
          }
        }
      })
    },

    removeTab(tabId: string) {
      const state = get()
      const openTab = state.requestTabsState.openTabs[tabId]
      if (!openTab) {
        return
      }

      const { collectionId, requestId } = openTab

      set((app) => {
        const state = app.requestTabsState

        // If we removed the activeTab, we need to activate another
        if (tabId === state.activeTab) {
          // Reset first
          state.activeTab = null

          const sorted = Object.values(state.openTabs).sort((a, b) => a.order - b.order)
          const idx = sorted.findIndex((t) => t.order === openTab.order)
          if (idx !== -1) {
            // Determine the next active tab, prioritizing the one after the closed tab.
            let nextActiveTab = sorted[idx + 1]
            if (!nextActiveTab) {
              // If the closed tab was the last one, fall back to the one before it.
              nextActiveTab = sorted[idx - 1]
            }

            if (nextActiveTab) {
              state.activeTab = nextActiveTab.tabId
            }
          }
        }

        delete state.openTabs[tabId]

        // Remove from index.opened
        const idx = app.collectionsState.index.find((m) => m.id === collectionId)
        if (idx?.opened) {
          idx.opened = idx.opened.filter((rid) => rid !== requestId)
        }

        recomputeOrderedTabs(state)
      })

      // Cleanup temp file if present
      try {
        const prev = openTab.response?.data
        if (prev && prev.type === "http") {
          const fp = (prev.data as { filePath?: string }).filePath
          if (fp) {
            void deleteFile(fp)
          }
        }
      } catch {}

      const collectionsApi = storeApi.getState().collectionsApi
      if (isScratchCollection(collectionId)) {
        // Closing a scratch tab should remove the transient request
        void collectionsApi.deleteRequest(collectionId, requestId)
      } else {
        // Never delete persisted requests on tab close. Commit or discard patch.
        const req = collectionsApi.getRequest(collectionId, requestId)
        const merged = toMergedRequest(req)
        if (merged.autoSave) {
          // Fire & Forget
          void collectionsApi.commitRequestPatch(collectionId, requestId)
        } else {
          void collectionsApi.discardRequestPatch(collectionId, requestId)
        }
      }
    },

    closeAllTabs() {
      const ordered = Object.values(get().requestTabsState.openTabs).sort((a, b) => a.order - b.order)
      for (const tab of ordered) {
        requestTabsApi.removeTab(tab.tabId)
      }
    },

    closeTabsToLeft(tabId: string) {
      const ordered = Object.values(get().requestTabsState.openTabs).sort((a, b) => a.order - b.order)
      const targetIndex = ordered.findIndex((tab) => tab.tabId === tabId)
      if (targetIndex <= 0) {
        return
      }

      const toClose = ordered.slice(0, targetIndex)
      for (const tab of toClose) {
        requestTabsApi.removeTab(tab.tabId)
      }

      requestTabsApi.setActiveTab(tabId)
    },

    closeTabsToRight(tabId: string) {
      const ordered = Object.values(get().requestTabsState.openTabs).sort((a, b) => a.order - b.order)
      const targetIndex = ordered.findIndex((tab) => tab.tabId === tabId)
      if (targetIndex === -1 || targetIndex === ordered.length - 1) {
        return
      }

      const toClose = ordered.slice(targetIndex + 1)
      for (const tab of toClose) {
        requestTabsApi.removeTab(tab.tabId)
      }

      requestTabsApi.setActiveTab(tabId)
    },

    closeOthers(tabId: string) {
      const ordered = Object.values(get().requestTabsState.openTabs).sort((a, b) => a.order - b.order)
      const toClose = ordered.filter((tab) => tab.tabId !== tabId)
      for (const tab of toClose) {
        requestTabsApi.removeTab(tab.tabId)
      }

      requestTabsApi.setActiveTab(tabId)
    },

    saveTab(tabId: string) {
      const tab = get().requestTabsState.openTabs[tabId]
      if (tab) {
        void storeApi.getState().collectionsApi.commitRequestPatch(tab.collectionId, tab.requestId)
      }
    },

    saveNewTab(tabId: string, collectionId: string, name: string): void {
      const tab = nonNull(get().requestTabsState.openTabs[tabId])

      // Make sure both collections are loaded
      storeApi.getState().collectionsApi.getCollection(collectionId)
      storeApi.getState().collectionsApi.getCollection(tab.collectionId)

      // Update the tab to use the new collection
      set((app) => {
        saveScratchRequest(app, {
          id: tab.requestId,
          collectionId,
          name,
        })

        const openTab = app.requestTabsState.openTabs[tabId]
        // Guard against tab being closed
        if (openTab) {
          const oldCollectionId = openTab.collectionId
          openTab.collectionId = collectionId

          // Update collections index to track opened requests
          // Remove from old collection's opened array
          const oldIdx = app.collectionsState.index.find((m) => m.id === oldCollectionId)
          if (oldIdx?.opened) {
            oldIdx.opened = oldIdx.opened.filter((rid) => rid !== tab.requestId)
          }

          // Add to new collection's opened array
          const newIdx = app.collectionsState.index.find((m) => m.id === collectionId)
          if (newIdx) {
            const opened = new Set(newIdx.opened ?? [])
            opened.add(tab.requestId)
            newIdx.opened = Array.from(opened)
          }
        }
      })
    },

    updateTabRequest(tabId: string, request: Partial<RequestState>) {
      const tab = get().requestTabsState.openTabs[tabId]
      assert(tab, `Tab ${tabId} is not an open tab`)

      const { collectionId: _z, id: _y, method, url, name, ...rest } = request
      const api = storeApi.getState().collectionsApi

      if (method !== undefined) {
        api.setRequestMethod(tab.collectionId, tab.requestId, method)
      }
      if (url !== undefined) {
        api.setRequestUrl(tab.collectionId, tab.requestId, url)
      }
      if (name !== undefined) {
        api.setRequestName(tab.collectionId, tab.requestId, name)
      }

      const remainingKeys = Object.keys(rest).filter((key) => rest[key as keyof typeof rest] !== undefined)
      assert(remainingKeys.length === 0, `updateTabRequest received unsupported fields: ${remainingKeys.join(", ")}`)

      // Update the merged request after the patch is applied
      updateMergedRequest(tabId)
    },

    updateTabResponse(tabId: string, patch: Partial<ResponseState>) {
      if (isNotEmpty(patch)) {
        set((app) => {
          const openTab = app.requestTabsState.openTabs[tabId]
          // Guard against tab being closed
          if (openTab) {
            if (openTab.response) {
              merge(openTab.response, patch)
            } else {
              openTab.response = patch
            }
          }
        })
      }
    },

    selectEnvironment: (tabId: string, environmentId: string | undefined) => {
      set((app) => {
        const tab = app.requestTabsState.openTabs[tabId]
        if (tab) {
          tab.selectedEnvironmentId = environmentId === "none" ? undefined : environmentId
        }
      })
    },

    async sendRequest(tabId: string, request: RequestState): Promise<void> {
      const notifier: PipelineNotifier = {
        onStart: () => {
          // Cleanup any previous temp response file for this tab
          try {
            const prev = get().requestTabsState.openTabs[tabId]?.response?.data
            if (prev && prev.type === "http") {
              const fp = (prev.data as { filePath?: string }).filePath
              if (fp) {
                void deleteFile(fp)
              }
            }
          } catch {}
          set((app) => {
            const openTab = app.requestTabsState.openTabs[tabId]
            if (openTab) {
              openTab.sending = true
              openTab.response = { logs: [], logFilterLevels: openTab.response?.logFilterLevels ?? DEFAULT_LOG_LEVELS }
            }
          })
        },
        onSuccess: (response) => {
          set((app) => {
            const openTab = app.requestTabsState.openTabs[tabId]
            if (openTab) {
              openTab.response = merge(openTab.response ?? {}, response)
              openTab.sending = false
            }
          })
        },
        onError: (error) => {
          console.error("Request pipeline failed:", error)
          set((app) => {
            const openTab = app.requestTabsState.openTabs[tabId]
            if (openTab) {
              openTab.sending = false
              // Synthesize a log entry so the user sees details in the Response logs
              const now = new Date().toISOString()
              openTab.response ??= {}
              openTab.response.logs ??= []
              const message = (error as Error)?.message ?? String(error)
              // Attach structured appError if present
              let details: AppError | undefined
              if (error && typeof error === "object" && "appError" in (error as Record<string, unknown>)) {
                const appErr = (error as { appError?: unknown }).appError
                if (appErr && typeof appErr === "object") {
                  details = appErr as AppError
                }
              }
              openTab.response.logs.push({
                requestId: openTab.activeCorrelationId ?? "unknown",
                timestamp: now,
                level: "error",
                infoType: "pipeline",
                message,
                category: "error",
                phase: "fail",
                details,
              })
            }
          })
        },
        onLog: (entry) => {
          set((app) => {
            const openTab = app.requestTabsState.openTabs[tabId]
            if (openTab?.response?.logs) {
              openTab.response.logs.push(entry)
            }
          })
        },
      }

      const tab = get().requestTabsState.openTabs[tabId]
      assert(tab, `sendRequest called with unknown tabId:${tabId}`)

      // Ensure collection (and its environments) are loaded before variable resolution
      const collection = storeApi.getState().collectionsApi.getCollection(tab.collectionId)

      let logUnlisten: (() => void) | null = null
      const requestId = generateUniqueId()
      try {
        // Store active correlation id for UI cancel button
        set((app) => {
          const t = app.requestTabsState.openTabs[tabId]
          if (t) {
            t.activeCorrelationId = requestId
          }
        })
        logUnlisten = await listen<LogEntry>("http-request-log", (event) => {
          const entry = event.payload
          if (entry.requestId === requestId) {
            notifier.onLog(entry)
          }
        })

        const envId = tab.selectedEnvironmentId ?? collection.activeEnvironmentId
        const environment = envId ? collection.environments?.[envId] : undefined

        const initialContext: RequestContext = {
          request: structuredClone(request),
          environment,
          response: {},
          correlationId: requestId,
        }

        const authPhase = createAuthPhase(get, set)
        const phases: RequestPhase[] = [resolveVariablesPhase, authPhase, protocolDispatchPhase]

        await runPipeline(phases, initialContext, notifier)
      } finally {
        if (logUnlisten) {
          logUnlisten()
        }
        set((app) => {
          const t = app.requestTabsState.openTabs[tabId]
          if (t) {
            t.sending = false
            t.activeCorrelationId = undefined
          }
        })
      }
    },

    async cancelRequest(tabId: string): Promise<void> {
      const state = get()
      const openTab = state.requestTabsState.openTabs[tabId]
      if (!openTab?.activeCorrelationId) {
        return
      }
      try {
        await cancelHttpRequest(openTab.activeCorrelationId)
      } catch (e) {
        console.warn("cancelHttpRequest failed", e)
      } finally {
        set((app) => {
          const t = app.requestTabsState.openTabs[tabId]
          if (t) {
            t.sending = false
            t.activeCorrelationId = undefined
          }
        })
      }
    },

    async runAuthOnly(tabId: string): Promise<void> {
      const tab = get().requestTabsState.openTabs[tabId]
      assert(tab, `runAuthOnly called with unknown tabId:${tabId}`)

      set((app) => {
        const openTab = app.requestTabsState.openTabs[tabId]
        if (openTab) {
          openTab.sending = true
          openTab.response ??= {}
          openTab.response.logs = []
          openTab.response.logFilterLevels ??= DEFAULT_LOG_LEVELS
        }
      })

      const requestId = generateUniqueId()
      let logUnlisten: (() => void) | null = null
      try {
        const state = get()
        const merged = state.requestTabsState.openTabs[tabId]?.merged
        assert(merged, `runAuthOnly called with missing merged request for tabId:${tabId}`)

        // Resolve environment variables
        const environment = tab.selectedEnvironmentId
          ? requireLoadedCollection(state, tab.collectionId).environments[tab.selectedEnvironmentId]
          : undefined
        const resolvedRequest = resolveRequestVariables(merged, environment)

        // Listen for log events (same stream as normal send)
        logUnlisten = await listen<LogEntry>("http-request-log", (event) => {
          const logEntry = event.payload
          if (logEntry.requestId !== requestId) {
            return
          }
          set((app) => {
            const currentTab = app.requestTabsState.openTabs[tabId]
            if (currentTab?.response?.logs) {
              currentTab.response.logs.push(logEntry)
            }
          })
        })

        // Compute effective auth
        const { credentialsCacheApi } = state
        const collection = requireLoadedCollection(state, resolvedRequest.collectionId)

        const effectiveAuth =
          resolvedRequest.authentication.type === "inherit"
            ? collection.authentication
            : {
                ...resolvedRequest.authentication,
                // biome-ignore lint/suspicious/noExplicitAny: OK
                ...((resolvedRequest.authentication as any)[resolvedRequest.authentication.type] ?? {}),
              }

        if (!effectiveAuth || effectiveAuth.type === "none" || effectiveAuth.type === "inherit") {
          return
        }

        // Force fresh token; still correlated via parent request id for logs
        // Map UI auth config to backend bindings before invoking
        const auth = effectiveAuth.type === "inherit" ? effectiveAuth : effectiveAuth
        const toBindingAuth = (authCfg: typeof effectiveAuth) => {
          switch (authCfg.type) {
            case "none":
            case "inherit":
              return { type: authCfg.type }
            case "basic":
              return { type: "basic", username: authCfg.basic?.username, password: authCfg.basic?.password }
            case "bearer":
              return {
                type: "bearer",
                token: authCfg.bearer?.token,
                scheme: authCfg.bearer?.scheme,
                placement: authCfg.bearer?.placement,
              }
            case "apiKey":
              return {
                type: "apiKey",
                key: authCfg.apiKey?.key,
                value: authCfg.apiKey?.value,
                placement: authCfg.apiKey?.placement,
              }
            case "oauth2":
              return {
                type: "oauth2",
                grantType: authCfg.oauth2?.grantType,
                authUrl: authCfg.oauth2?.authUrl,
                tokenUrl: authCfg.oauth2?.tokenUrl,
                deviceAuthorizationUrl: authCfg.oauth2?.deviceAuthorizationUrl,
                discoveryUrl: authCfg.oauth2?.discoveryUrl,
                clientId: authCfg.oauth2?.clientId,
                clientSecret: authCfg.oauth2?.clientSecret,
                scope: authCfg.oauth2?.scope,
                refreshToken: authCfg.oauth2?.refreshToken,
                redirectUri: authCfg.oauth2?.redirectUri,
                usePkce: authCfg.oauth2?.usePkce,
                tokenCaching: authCfg.oauth2?.tokenCaching,
                clientAuth: authCfg.oauth2?.clientAuth,
                tokenExtraParams: authCfg.oauth2?.tokenExtraParams,
              }
          }
        }
        const authResult = await getAuthenticationResult(toBindingAuth(auth), requestId)

        // Store to session cache so UI token field updates
        const cacheKey = credentialsCacheApi.generateCacheKey(merged.id)
        await credentialsCacheApi.set(cacheKey, authResult)
      } finally {
        if (logUnlisten) {
          logUnlisten()
        }
        set((app) => {
          const openTab = app.requestTabsState.openTabs[tabId]
          if (openTab) {
            openTab.sending = false
          }
        })
      }
    },

    clearResponse(tabId: string) {
      set((app) => {
        const openTab = app.requestTabsState.openTabs[tabId]
        if (openTab) {
          const existingLevels = openTab.response?.logFilterLevels ?? DEFAULT_LOG_LEVELS
          openTab.response = {
            logFilterLevels: existingLevels,
            logs: [],
          }
        }
      })
    },

    setResponseLogFilter(tabId: string, levels: LogLevel[]) {
      set((app) => {
        const openTab = app.requestTabsState.openTabs[tabId]
        if (openTab) {
          openTab.response ??= {}
          openTab.response.logFilterLevels = [...levels]
        }
      })
    },
  }

  // Set up subscription to collection changes after store initialization
  // We need to update merged requests when collections change
  const setupCollectionSubscription = () => {
    try {
      storeApi.subscribe(
        (state) => state.collectionsState?.cache || {},
        (cache, prevCache) => {
          const openTabs = get().requestTabsState.openTabs

          // Check each open tab for request changes
          for (const tab of Object.values(openTabs)) {
            const currentRequest = cache[tab.collectionId]?.requests[tab.requestId]
            const prevRequest = prevCache?.[tab.collectionId]?.requests[tab.requestId]

            // Update the merged request if the underlying request changed
            if (currentRequest && currentRequest.updated !== prevRequest?.updated) {
              updateMergedRequest(tab.tabId)
            }
          }
        },
      )
    } catch (error) {
      console.warn("Failed to set up collection subscription:", error)
    }
  }

  // Defer subscription setup to avoid initialization race conditions
  requestAnimationFrame(setupCollectionSubscription)

  // Restore open tabs from collections index (opened arrays) after index loads
  const tryRestoreFromIndex = async () => {
    if (restoredFromIndex) {
      return
    }
    const entries = storeApi.getState().collectionsState.index
    const initialTargets = entries.flatMap((e) =>
      (e.opened ?? []).map((rid) => ({ collectionId: e.id, requestId: rid })),
    )
    if (initialTargets.length === 0) {
      return
    }

    restoredFromIndex = true
    await Promise.all(
      initialTargets.map(({ collectionId, requestId }) =>
        requestTabsApi
          .loadTab(collectionId, requestId)
          .catch((error) => console.warn(`Failed to load request ${requestId} from collection ${collectionId}`, error)),
      ),
    )

    const collectionsApi = storeApi.getState().collectionsApi
    const indexAfterLoad = storeApi.getState().collectionsState.index
    await Promise.all(
      indexAfterLoad
        .filter((entry) => (entry.opened?.length ?? 0) > 0)
        .map((entry) =>
          collectionsApi
            .loadCollection(entry.id)
            .catch((error) => console.warn(`Failed to reload collection ${entry.id} for opened tabs`, error)),
        ),
    )

    // After collections are loaded, drop any stale requestIds from index.opened
    set((app) => {
      for (const idx of app.collectionsState.index) {
        const opened = idx.opened
        if (!opened || opened.length === 0) {
          continue
        }
        const col = requireLoadedCollection(app, idx.id)
        const filtered = opened.filter((rid) => !!col.requests[rid])
        if (filtered.length !== opened.length) {
          idx.opened = filtered
        }
      }
    })

    const entriesAfter = storeApi.getState().collectionsState.index
    const targets = entriesAfter.flatMap((e) => (e.opened ?? []).map((rid) => ({ collectionId: e.id, requestId: rid })))

    set((app) => {
      const next: RequestTabsSlice["requestTabsState"]["openTabs"] = {}
      let order = 0
      for (const t of targets) {
        const id = generateUniqueId()
        next[id] = {
          tabId: id,
          order: order++,
          collectionId: t.collectionId,
          requestId: t.requestId,
          activeTab: "params",
        } as RequestTabState
      }
      app.requestTabsState.openTabs = next
      app.requestTabsState.activeTab = Object.keys(next)[0] ?? null
      recomputeOrderedTabs(app.requestTabsState)
    })

    for (const tab of Object.values(get().requestTabsState.openTabs)) {
      updateMergedRequest(tab.tabId)
    }
  }

  // Register a post-hydrate action to restore tabs without long-lived subscriptions
  try {
    storeApi.registerPostHydrate(() => tryRestoreFromIndex())
  } catch (_e) {
    // no-op in tests without storage manager
  }

  return {
    requestTabsState: {
      openTabs: {},
      activeTab: null,
      orderedTabs: [],
    },
    requestTabsApi,
  }
}
