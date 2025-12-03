import { use as resource, useMemo } from "react"

import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { useShallow } from "zustand/shallow"

import { assert, generateUniqueId } from "@/lib"
import { formatWithPrettier } from "@/lib/prettier"
import { createCredentialsCacheSlice } from "@/state/credentials"
import { dialogsSliceCreator } from "@/state/dialogs"
import { requestTabsSliceCreator } from "@/state/request-tabs"
import { createSettingsSlice } from "@/state/settings"
import { utilitySheetsSliceCreator } from "@/state/utility-sheets"
import {
  type Application,
  type ClientOptionsData,
  type Collection,
  type CollectionCache,
  type CollectionsApi,
  type CollectionsSlice,
  type Cookie,
  type CredentialsCacheApi,
  type Environment,
  type FormField,
  type HttpMethod,
  isRequestDirty,
  type RequestBodyData,
  type RequestCookieParam,
  type RequestHeader,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  type RequestTabsApi,
  type RequestTabState,
  type SidebarApi,
  type SidebarState,
  toMergedRequest,
  type UtilitySheetsApi,
  zFormField,
  zRequestPathParam,
} from "@/types"
import { withStorageManager } from "@/types/middleware/storage-manager"
import { collectionTreeSliceCreator } from "./collection-tree"
import { createCollectionsSlice, isScratchCollection } from "./collections"
import { sidebarSliceCreator } from "./sidebar"

export const useApplication = create<Application>()(
  withStorageManager(
    immer(
      subscribeWithSelector((set, get, store) => ({
        ...createCollectionsSlice(set, get, store),
        ...requestTabsSliceCreator(set, get, store),
        ...sidebarSliceCreator(set, get, store),
        ...collectionTreeSliceCreator(set, get, store),
        ...createSettingsSlice(set, get, store),
        ...createCredentialsCacheSlice(set, get, store),
        ...utilitySheetsSliceCreator(set, get, store),
        ...dialogsSliceCreator(set, get, store),
      })),
    ),
  ),
)

///
/// Stable API references
///
export const collectionsApi = () => useApplication.getState().collectionsApi
export const settingsApi = () => useApplication.getState().settingsApi
export const credentialsCacheApi = (): CredentialsCacheApi => useApplication.getState().credentialsCacheApi
// const requestTabsApi = useApplication.getState().requestTabsApi
// const requestTabsApi = useApplication.getState().sidebarApi
export const environmentsApi = () => useApplication.getState().collectionsApi
export const utilitySheetsApi = () => useApplication.getState().utilitySheetsApi
export const dialogsApi = () => useApplication.getState().dialogsApi

///
/// Stable load collection promises for use in these hooks
///
const collectionPromises = new Map<string, Promise<CollectionCache>>()
export const invalidateCollectionPromise = (collectionId: string): void => {
  collectionPromises.delete(collectionId)
}

const waitForLoadedCollection = (collectionId: string) => {
  if (!collectionPromises.has(collectionId)) {
    collectionPromises.set(collectionId, collectionsApi().loadCollection(collectionId))
  }
  const promise = collectionPromises.get(collectionId)
  assert(promise, `Failed to load collection ${collectionId}`)
  return promise
}

type HookResult<State, Actions> = {
  state: State
  actions: Actions
}

export const getSidebarApi = () => useApplication.getState().sidebarApi
export const getRequestTabsApi = () => useApplication.getState().requestTabsApi
export const getUtilitySheetsApi = () => useApplication.getState().utilitySheetsApi
export const getCollectionTreeApi = () => useApplication.getState().collectionTreeApi
const requireLoadedCollection = (state: Application, collectionId: string) => {
  const collection = state.collectionsState.cache[collectionId]
  assert(collection, `Collection ${collectionId} must be loaded before use`)
  return collection
}

type CollectionsHookState = {
  collectionsIndex: CollectionsSlice["collectionsState"]["index"]
}

type CollectionsHookActions = {
  collectionsApi: typeof collectionsApi
}

export const useCollections = (): HookResult<CollectionsHookState, CollectionsHookActions> => {
  console.log('[useCollections] hook called')
  const collectionsIndex = useApplication(
    // Hide the scratch collection if it's empty
    useShallow((app) => app.collectionsState.index.filter((m) => m.count > 0 || !isScratchCollection(m.id))),
  )
  console.log('[useCollections] returning', collectionsIndex.length, 'collections')

  return {
    state: {
      collectionsIndex,
    },
    actions: {
      collectionsApi,
    },
  }
}

type CollectionHookState = {
  collection: CollectionCache
  loaded: boolean
}

type CollectionHookActions = {
  collectionsApi: typeof collectionsApi
}

export const useCollection = (collectionId: string): HookResult<CollectionHookState, CollectionHookActions> => {
  console.log('[useCollection] hook called for collectionId:', collectionId)
  const collection = useApplication((app) => app.collectionsState.cache[collectionId])
  console.log('[useCollection] collection loaded:', !!collection)

  if (!collection) {
    console.log('[useCollection] collection not loaded, triggering suspension')
    resource(waitForLoadedCollection(collectionId))
  }

  assert(collection, `useCollection called with an unknown collectionId:${collectionId}`)

  return {
    state: {
      collection,
      loaded: collection !== undefined,
    },
    actions: {
      collectionsApi,
    },
  }
}

export const useCollectionsApi = (): (() => CollectionsApi) => collectionsApi

// Helpers
//

type SidebarHookActions = {
  sidebarApi: SidebarApi
  setCollapsed: (collapsed: boolean) => void
  collapseSidebar: () => void
  expandSidebar: () => void
  setPanelGroupApi: SidebarApi["setPanelGroupApi"]
}

type SidebarHookState = Pick<SidebarState, "isCollapsed">

export const useSidebar = (): HookResult<SidebarHookState, SidebarHookActions> => {
  const isCollapsed = useApplication((state) => state.sidebarState.isCollapsed)

  return {
    state: {
      isCollapsed,
    },
    actions: {
      sidebarApi: getSidebarApi(),
      setCollapsed: (collapsed: boolean) => getSidebarApi().setCollapsed(collapsed),
      collapseSidebar: () => getSidebarApi().collapseSidebar(),
      expandSidebar: () => getSidebarApi().expandSidebar(),
      setPanelGroupApi: (panel) => getSidebarApi().setPanelGroupApi(panel),
    },
  }
}

type CollectionTreeHookState = {
  searchTerm: string
  expandedIds: Record<string, boolean>
}

type CollectionTreeHookActions = {
  toggleExpanded: (id: string) => void
  setExpanded: (id: string, expanded: boolean) => void
  setSearchTerm: (term: string) => void
  clearSearch: () => void
}

export const useCollectionTree = (): HookResult<CollectionTreeHookState, CollectionTreeHookActions> => {
  const collectionTreeState = useApplication((state) => state.collectionTreeState)

  return {
    state: {
      searchTerm: collectionTreeState.searchTerm,
      expandedIds: collectionTreeState.expandedIds ?? {},
    },
    actions: {
      toggleExpanded: (id: string) => getCollectionTreeApi().toggleExpanded(id),
      setExpanded: (id: string, expanded: boolean) => getCollectionTreeApi().setExpanded(id, expanded),
      setSearchTerm: (term: string) => getCollectionTreeApi().setSearchTerm(term),
      clearSearch: () => getCollectionTreeApi().clearSearch(),
    },
  }
}

type OpenTabsHookState = {
  openTabs: RequestTabState[]
}

type OpenTabsHookActions = {
  requestTabsApi: RequestTabsApi
}

export const useOpenTabs = (): HookResult<OpenTabsHookState, OpenTabsHookActions> => {
  const openTabs = useApplication((app) => app.requestTabsState.orderedTabs)

  return {
    state: {
      openTabs,
    },
    actions: {
      requestTabsApi: getRequestTabsApi(),
    },
  }
}

type UtilitySheetsHookState = ReturnType<typeof useApplication>["utilitySheetsState"] & {
  activeSheet: ReturnType<typeof useApplication>["utilitySheetsState"]["stack"][number] | null
}

type UtilitySheetsHookActions = {
  utilitySheetsApi: UtilitySheetsApi
}

export const useUtilitySheets = (): HookResult<UtilitySheetsHookState, UtilitySheetsHookActions> => {
  const utilitySheetsState = useApplication(useShallow((app) => app.utilitySheetsState))
  const activeSheet =
    utilitySheetsState.stack.length > 0 ? utilitySheetsState.stack[utilitySheetsState.stack.length - 1] : null

  return {
    state: {
      ...utilitySheetsState,
      activeSheet,
    },
    actions: {
      utilitySheetsApi: getUtilitySheetsApi(),
    },
  }
}

type RequestTabHookState = {
  activeTab: RequestTabState
  request: RequestState
  original: RequestState
  isDirty: boolean
}

type RequestTabHookActions = {
  requestTabsApi: RequestTabsApi
}

export function useRequestTab(tabId: string): HookResult<RequestTabHookState, RequestTabHookActions>
export function useRequestTab(tabId?: string): HookResult<RequestTabHookState, RequestTabHookActions> | null
export function useRequestTab(tabId?: string): HookResult<RequestTabHookState, RequestTabHookActions> | null {
  const activeTabId = useActiveTabId()
  const effectiveTabId = tabId ?? activeTabId

  const selectorData = useApplication(
    useShallow((app) => {
      if (!effectiveTabId) {
        return null
      }

      const tab = app.requestTabsState.openTabs[effectiveTabId]
      if (!tab) {
        return null
      }

      const collection = requireLoadedCollection(app, tab.collectionId)
      const original = collection.requests[tab.requestId]
      if (!original) {
        return null
      }

      return {
        activeTab: tab,
        original,
        isDirty: isRequestDirty(original),
        requestVersion: original.updated,
      }
    }),
  )

  // Use useMemo to compute merged request based on request version.
  // This ensures merged request is recomputed only when original.updated changes,
  // preventing infinite loops while maintaining freshness of derived data (like auth).
  const data = useMemo(() => {
    if (!selectorData) {
      return null
    }

    return {
      activeTab: selectorData.activeTab,
      request: toMergedRequest(selectorData.original),
      original: selectorData.original,
      isDirty: selectorData.isDirty,
    }
  }, [selectorData?.requestVersion, selectorData])

  // If a tabId was explicitly provided, we expect the data to exist.
  // If it doesn't, it's a programming error (e.g., component rendered with stale ID).
  if (tabId) {
    assert(
      data,
      `useRequestTab: No data found for tabId '${tabId}'. The tab may have been closed or data is not loaded.`,
    )
  }

  if (!data) {
    return null
  }

  return {
    state: data,
    actions: {
      requestTabsApi: getRequestTabsApi(),
    },
  }
}

export type UseRequestsTabSummary = {
  isActive: boolean
  name: string
  method: HttpMethod
  isDirty: boolean
  requestId: string
  collectionId: string
}

export const useRequestsTabSummary = (tabId: string): UseRequestsTabSummary => {
  return useApplication(
    useShallow((app) => {
      const tab = app.requestTabsState.openTabs[tabId]
      assert(tab, `useRequestsTabSummary called with unknown tabId:${tabId}`)
      const collection = requireLoadedCollection(app, tab.collectionId)
      const originalRequest = collection.requests[tab.requestId]
      assert(
        originalRequest,
        `useRequestsTabSummary tab ${tabId} collection ${tab.collectionId} has unknown requestId:${tab.requestId}`,
      )

      const isActive = app.requestTabsState.activeTab === tabId
      // Use pre-computed merged request if available, otherwise fallback to patch logic
      const merged = tab.merged ?? toMergedRequest(originalRequest)
      const name = merged.name
      const method = merged.method
      const isDirty = isRequestDirty(originalRequest)

      return { isActive, name, method, isDirty, requestId: tab.requestId, collectionId: tab.collectionId }
    }),
  )
}

export const useActiveTabId = () => {
  return useApplication((app) => app.requestTabsState.activeTab)
}

//
// Environments
//

type EnvironmentsHookState = {
  collection: Pick<Collection, "id" | "name">
  environments: Record<string, Environment>
}

type EnvironmentsHookActions = {
  environmentsApi: typeof environmentsApi
}

export const useEnvironments = (collectionId: string): HookResult<EnvironmentsHookState, EnvironmentsHookActions> => {
  const collection = useApplication((app) => app.collectionsState.cache[collectionId])

  if (!collection) {
    resource(waitForLoadedCollection(collectionId))
  }

  // use will have ensured that the collection is loaded or failed to load
  assert(collection, `useEnvironments called with unknown collectionId:${collectionId}`)

  return useMemo(() => {
    return {
      state: {
        collection: {
          id: collectionId,
          name: collection.name,
        },
        environments: collection.environments,
      },
      actions: {
        environmentsApi,
      },
    }
  }, [collectionId, collection.name, collection.environments])
}

type EnvironmentHookState = {
  collection: Pick<Collection, "id" | "name">
  environment: Environment
}

type EnvironmentHookActions = {
  environmentsApi: typeof environmentsApi
}

export const useEnvironment = (
  collectionId: string,
  environmentId: string,
): HookResult<EnvironmentHookState, EnvironmentHookActions> => {
  const collection = useApplication((app) => app.collectionsState.cache[collectionId])

  if (!collection) {
    resource(waitForLoadedCollection(collectionId))
  }

  // use will have ensured that the collection is loaded or failed to load
  assert(collection, `useEnvironments called with unknown collectionId:${collectionId}`)

  const environment = collection.environments[environmentId]
  assert(environment, `useEnvironment called with unknown collection:${collectionId} environmentId:${environmentId}`)

  return useMemo(() => {
    return {
      state: {
        collection: {
          id: collectionId,
          name: collection.name,
        },
        environment,
      },
      actions: {
        environmentsApi,
      },
    }
  }, [collectionId, collection.name, environment])
}

//
// Settings
//
type SettingsHookState = Application["settingsState"]

type SettingsHookActions = {
  settingsApi: typeof settingsApi
}

export const useSettings = (): HookResult<SettingsHookState, SettingsHookActions> => {
  const settingsState = useApplication((app) => app.settingsState)

  return {
    state: settingsState,
    actions: {
      settingsApi,
    },
  }
}

type ThemeHookState = {
  theme: Application["settingsState"]["appearance"]["theme"]
}

type ThemeHookActions = {
  setTheme: (theme: Application["settingsState"]["appearance"]["theme"]) => void
}

export const useTheme = (): HookResult<ThemeHookState, ThemeHookActions> => {
  const theme = useApplication((app) => app.settingsState.appearance.theme)

  return {
    state: {
      theme,
    },
    actions: {
      setTheme: (value) => settingsApi().setTheme(value),
    },
  }
}

// Focused hooks for request editor panels
type RequestParametersState = {
  queryParams: RequestState["patch"]["queryParams"]
  pathParams: RequestState["patch"]["pathParams"]
  cookieParams: RequestState["patch"]["cookieParams"]
  original: {
    queryParams: RequestState["patch"]["queryParams"]
    pathParams: RequestState["patch"]["pathParams"]
    cookieParams: RequestState["patch"]["cookieParams"]
  }
}

type RequestParametersActions = {
  updateQueryParam: (id: string, updates: Partial<RequestQueryParam>) => void
  updatePathParam: (id: string, updates: Partial<RequestPathParam>) => void
  removeQueryParam: (id: string) => void
  removePathParam: (id: string) => void
  addQueryParam: () => void
  addPathParam: () => void
  updateCookieParam: (id: string, updates: Partial<RequestCookieParam>) => void
  removeCookieParam: (id: string) => void
  addCookieParam: () => void
  reorderPathParams: (orderedIds: string[]) => void
  reorderQueryParams: (orderedIds: string[]) => void
  reorderCookieParams: (orderedIds: string[]) => void
}

export const useRequestParameters = (tabId: string): HookResult<RequestParametersState, RequestParametersActions> => {
  const result = useRequestTab(tabId)
  assert(result, `useRequestParameters called with unknown tabId:${tabId}`)
  const {
    state: { request, original, activeTab },
  } = result

  return {
    state: {
      queryParams: request.queryParams,
      pathParams: request.pathParams,
      cookieParams: request.cookieParams,
      original: {
        queryParams: original.queryParams,
        pathParams: original.pathParams,
        cookieParams: original.cookieParams,
      },
    },
    actions: {
      updateQueryParam: (id: string, updates: Partial<RequestQueryParam>) =>
        collectionsApi().updateRequestPatchQueryParam(activeTab.collectionId, activeTab.requestId, id, updates),
      updatePathParam: (id: string, updates: Partial<RequestPathParam>) =>
        collectionsApi().updateRequestPatchPathParam(activeTab.collectionId, activeTab.requestId, id, updates),
      removeQueryParam: (id: string) =>
        collectionsApi().updateRequestPatchQueryParam(activeTab.collectionId, activeTab.requestId, id, null),
      removePathParam: (id: string) =>
        collectionsApi().updateRequestPatchPathParam(activeTab.collectionId, activeTab.requestId, id, null),
      addQueryParam: () => {
        const id = generateUniqueId(8)
        collectionsApi().updateRequestPatchQueryParam(activeTab.collectionId, activeTab.requestId, id, {})
      },
      addPathParam: () => {
        const id = generateUniqueId(8)
        collectionsApi().updateRequestPatchPathParam(
          activeTab.collectionId,
          activeTab.requestId,
          id,
          zRequestPathParam.parse({ id }),
        )
      },
      updateCookieParam: (id: string, updates: Partial<RequestCookieParam>) =>
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, updates),
      removeCookieParam: (id: string) =>
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, null),
      addCookieParam: () => {
        const id = generateUniqueId(8)
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, {})
      },
      reorderPathParams: (orderedIds: string[]) =>
        collectionsApi().reorderPathParams(activeTab.collectionId, activeTab.requestId, orderedIds),
      reorderQueryParams: (orderedIds: string[]) =>
        collectionsApi().reorderQueryParams(activeTab.collectionId, activeTab.requestId, orderedIds),
      reorderCookieParams: (orderedIds: string[]) =>
        collectionsApi().reorderCookieParams(activeTab.collectionId, activeTab.requestId, orderedIds),
    },
  }
}

type RequestHeadersState = {
  headers: RequestState["patch"]["headers"]
  original: RequestState["patch"]["headers"]
}

type RequestHeadersActions = {
  updateHeader: (id: string, updates: Partial<RequestHeader>) => void
  removeHeader: (id: string) => void
  addHeader: () => void
  reorderHeaders: (orderedIds: string[]) => void
}

export const useRequestHeaders = (tabId: string): HookResult<RequestHeadersState, RequestHeadersActions> => {
  const result = useRequestTab(tabId)
  assert(result, `useRequestHeaders called with unknown tabId:${tabId}`)
  const {
    state: { request, original, activeTab },
  } = result

  return {
    state: {
      headers: request.headers,
      original: original.headers,
    },
    actions: {
      updateHeader: (id: string, updates: Partial<RequestHeader>) =>
        collectionsApi().updateRequestPatchHeader(activeTab.collectionId, activeTab.requestId, id, updates),
      removeHeader: (id: string) =>
        collectionsApi().updateRequestPatchHeader(activeTab.collectionId, activeTab.requestId, id, null),
      addHeader: () => {
        const id = generateUniqueId(8)
        collectionsApi().updateRequestPatchHeader(activeTab.collectionId, activeTab.requestId, id, {})
      },
      reorderHeaders: (orderedIds: string[]) =>
        collectionsApi().reorderHeaders(activeTab.collectionId, activeTab.requestId, orderedIds),
    },
  }
}

type RequestCookiesState = {
  cookieParams: RequestState["patch"]["cookieParams"]
  original: RequestState["patch"]["cookieParams"]
}

type RequestCookiesActions = {
  addCookieParam: () => void
  updateCookieParam: (id: string, updates: Partial<RequestCookieParam>) => void
  removeCookieParam: (id: string) => void
  addCookieFromResponse: (cookie: Cookie) => void
}

export const useRequestCookies = (tabId: string): HookResult<RequestCookiesState, RequestCookiesActions> => {
  const result = useRequestTab(tabId)
  assert(result, `useRequestCookies called with unknown tabId:${tabId}`)
  const {
    state: { request, original, activeTab },
  } = result

  return {
    state: {
      cookieParams: request.cookieParams,
      original: original.cookieParams,
    },
    actions: {
      addCookieParam: () => {
        const id = generateUniqueId(8)
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, {})
      },
      updateCookieParam: (id: string, updates: Partial<RequestCookieParam>) =>
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, updates),
      removeCookieParam: (id: string) =>
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, null),
      addCookieFromResponse: (cookie: Cookie) => {
        const existing = Object.values(request.cookieParams ?? {}).find((c) => c.name === cookie.name)
        if (existing) {
          collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, existing.id, {
            value: cookie.value,
            enabled: true,
          })
        } else {
          const id = generateUniqueId(8)
          collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, {
            id,
            name: cookie.name,
            value: cookie.value,
            enabled: true,
          })
        }
      },
    },
  }
}

type RequestBodyState = {
  body: RequestBodyData
  original: RequestBodyData
}

type RequestBodyActions = {
  updateBodyContent: (content: string) => void
  updateBody: (update: Partial<RequestBodyData>) => void
  updateFormItem: (id: string, updates: Partial<FormField>) => void
  removeFormItem: (id: string) => void
  addFormItem: () => void
  formatContent: () => Promise<void>
}

export const useRequestBody = (tabId: string): HookResult<RequestBodyState, RequestBodyActions> => {
  const result = useRequestTab(tabId)
  assert(result, `useRequestBody called with unknown tabId:${tabId}`)
  const {
    state: { request, original, activeTab },
  } = result

  return {
    state: {
      body: request.body,
      original: original.body,
    },
    actions: {
      updateBodyContent: (content: string) =>
        void collectionsApi().updateRequestBody(activeTab.collectionId, activeTab.requestId, {
          content,
        }),
      updateBody: (update: Partial<RequestBodyData>) =>
        void collectionsApi().updateRequestBody(activeTab.collectionId, activeTab.requestId, update),
      updateFormItem: (id: string, updates: Partial<FormField>) =>
        void collectionsApi().setRequestBodyFormField(activeTab.collectionId, activeTab.requestId, id, updates),
      removeFormItem: (id: string) =>
        void collectionsApi().setRequestBodyFormField(activeTab.collectionId, activeTab.requestId, id, null),
      addFormItem: () => {
        const id = generateUniqueId(8)
        void collectionsApi().setRequestBodyFormField(
          activeTab.collectionId,
          activeTab.requestId,
          id,
          zFormField.parse({ id }),
        )
      },
      formatContent: async () => {
        const formatted = await formatWithPrettier(request.body.content ?? "", request.body.language ?? "text")
        void collectionsApi().updateRequestBody(activeTab.collectionId, activeTab.requestId, {
          content: formatted,
        })
      },
    },
  }
}

type RequestOptionsState = {
  options: RequestState["patch"]["options"]
  original: RequestState["patch"]["options"]
  autoSave: RequestState["autoSave"]
  originalAutoSave: RequestState["autoSave"]
}

type RequestOptionsActions = {
  updateClientOption: (updates: Partial<ClientOptionsData>) => void
  updateAutoSave: (value: boolean) => void
}

export const useRequestOptions = (tabId: string): HookResult<RequestOptionsState, RequestOptionsActions> => {
  const result = useRequestTab(tabId)
  assert(result, `useRequestOptions called with unknown tabId:${tabId}`)
  const {
    state: { request, original, activeTab },
  } = result

  return {
    state: {
      options: request.options,
      original: original.options,
      autoSave: request.autoSave,
      originalAutoSave: original.autoSave,
    },
    actions: {
      updateClientOption: (updates: Partial<ClientOptionsData>) =>
        collectionsApi().updateRequestOptions(activeTab.collectionId, activeTab.requestId, updates),
      updateAutoSave: (value: boolean) =>
        collectionsApi().setRequestAutoSave(activeTab.collectionId, activeTab.requestId, value),
    },
  }
}

//
// Cache Access Helpers
//

type CollectionCacheState = {
  collection: CollectionCache
}

type CollectionCacheActions = {
  collectionsApi: typeof collectionsApi
}

/**
 * Read a collection from cache without forcing load.
 * Returns undefined if not loaded. Use useCollection() if you need to ensure loading.
 */
export const useCollectionFromCache = (
  collectionId: string,
): HookResult<CollectionCacheState, CollectionCacheActions> => {
  // biome-ignore lint/style/noNonNullAssertion: Used only where we've ensured a collection is already loaded. If it's not, we will blow up intentionally to catch the error
  const collection = useApplication((app) => app.collectionsState.cache[collectionId]!)

  return {
    state: {
      collection,
    },
    actions: {
      collectionsApi,
    },
  }
}

type CredentialsCacheEntryState = {
  cacheEntry: string | undefined // Encrypted cache entry
}

type CredentialsCacheEntryActions = {
  credentialsCacheApi: CredentialsCacheApi
}

/**
 * Observe a credentials cache entry. Useful for reactivity when tokens are fetched/cached.
 * To retrieve the actual AuthResult, use credentialsCacheApi().get(cacheKey).
 */
export const useCredentialsCacheEntry = (
  cacheKey: string | undefined,
): HookResult<CredentialsCacheEntryState, CredentialsCacheEntryActions> => {
  const cacheEntry = useApplication((state) => (cacheKey ? state.credentialsCacheState.cache[cacheKey] : undefined))

  return {
    state: {
      cacheEntry,
    },
    actions: {
      credentialsCacheApi: credentialsCacheApi(),
    },
  }
}

type ActiveRequestState = {
  request: RequestState
  activeTab: RequestTabState | undefined
}

type ActiveRequestActions = {
  requestTabsApi: RequestTabsApi
}

/**
 * Get the merged request for the currently active tab.
 * Returns null if no active tab.
 */
export const useActiveRequest = (): HookResult<ActiveRequestState, ActiveRequestActions> | null => {
  const activeTabId = useActiveTabId()
  const result = useRequestTab(activeTabId)

  if (!result) {
    return null
  }

  return {
    state: {
      request: result.state.request,
      activeTab: result.state.activeTab,
    },
    actions: {
      requestTabsApi: getRequestTabsApi(),
    },
  }
}
