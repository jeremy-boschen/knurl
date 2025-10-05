import { use as resource /* get around biome treating 'use' as a hook */, useMemo } from "react"

import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { useShallow } from "zustand/shallow"

import { assert, generateUniqueId } from "@/lib"
import { formatWithPrettier } from "@/lib/prettier"
import { createCredentialsCacheSlice } from "@/state/credentials"
import { requestTabsSliceCreator } from "@/state/request-tabs"
import { createSettingsSlice } from "@/state/settings"
import { utilitySheetsSliceCreator } from "@/state/utility-sheets"
import {
  type ApplicationState,
  type ClientOptionsData,
  type CollectionCacheState,
  type CollectionState,
  type CollectionsStateApi,
  type CollectionsStateSlice,
  type CredentialsCacheStateApi,
  type Cookie,
  type RequestCookieParam,
  type Environment,
  type FormField,
  type HttpMethod,
  isRequestDirty,
  type RequestHeader,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  type RequestTabState,
  type RequestTabsStateApi,
  type SidebarState,
  type SidebarStateApi,
  type UtilitySheetsStateApi,
  toMergedRequest,
  zFormField,
  zRequestPathParam,
  type RequestBodyData,
} from "@/types"
import { withStorageManager } from "@/types/middleware/storage-manager"
import { createCollectionsSlice, isScratchCollection } from "./collections"
import { sidebarSliceCreator } from "./sidebar"

export const useApplication = create<ApplicationState>()(
  withStorageManager(
    immer(
      subscribeWithSelector((set, get, store) => ({
        ...createCollectionsSlice(set, get, store),
        ...requestTabsSliceCreator(set, get, store),
        ...sidebarSliceCreator(set, get, store),
        ...createSettingsSlice(set, get, store),
        ...createCredentialsCacheSlice(set, get, store),
        ...utilitySheetsSliceCreator(set, get, store),
      })),
    ),
  ),
)

///
/// Stable API references
///
export const collectionsApi = () => useApplication.getState().collectionsApi
export const settingsApi = () => useApplication.getState().settingsApi
export const credentialsCacheApi = (): CredentialsCacheStateApi => useApplication.getState().credentialsCacheApi
// const requestTabsApi = useApplication.getState().requestTabsApi
// const requestTabsApi = useApplication.getState().sidebarApi
export const environmentsApi = () => useApplication.getState().collectionsApi
export const utilitySheetsApi = () => useApplication.getState().utilitySheetsApi

///
/// Stable load collection promises for use in these hooks
///
const collectionPromises = new Map<string, Promise<CollectionState>>()
export const invalidateCollectionPromise = (collectionId: string): void => {
  collectionPromises.delete(collectionId)
}

const waitForLoadedCollection = (collectionId: string) => {
  if (!collectionPromises.has(collectionId)) {
    collectionPromises.set(collectionId, collectionsApi().getCollection(collectionId))
  }
  const promise = collectionPromises.get(collectionId)
  assert(promise, `Failed to load collection ${collectionId}`)
  return promise
}

type HookResult<State, Actions> = {
  state: State
  actions: Actions
}

const getSidebarApi = () => useApplication.getState().sidebarApi
const getRequestTabsApi = () => useApplication.getState().requestTabsApi
const getUtilitySheetsApi = () => useApplication.getState().utilitySheetsApi

function createApiProxy<T extends object>(getter: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const api = getter()
      const value = Reflect.get(api, prop, receiver)
      if (typeof value === "function") {
        return (...args: unknown[]) => Reflect.apply(value, api, args)
      }
      return value
    },
  })
}

const sidebarApiProxy = createApiProxy(getSidebarApi)
const requestTabsApiProxy = createApiProxy(getRequestTabsApi)
const utilitySheetsApiProxy = createApiProxy(getUtilitySheetsApi)

type CollectionsHookState = {
  collectionsIndex: CollectionsStateSlice["collectionsState"]["index"]
}

type CollectionsHookActions = {
  collectionsApi: typeof collectionsApi
}

export const useCollections = (): HookResult<CollectionsHookState, CollectionsHookActions> => {
  const collectionsIndex = useApplication(
    // Hide the scratch collection if it's empty
    useShallow((app) => app.collectionsState.index.filter((m) => m.count > 0 || !isScratchCollection(m.id))),
  )

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
  collection: CollectionCacheState
  loaded: boolean
}

type CollectionHookActions = {
  collectionsApi: typeof collectionsApi
}

export const useCollection = (collectionId: string): HookResult<CollectionHookState, CollectionHookActions> => {
  const collection = useApplication((app) => app.collectionsState.cache[collectionId])

  if (!collection) {
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

export const useCollectionsApi = (): (() => CollectionsStateApi) => collectionsApi

// Helpers
//

type SidebarHookActions = {
  sidebarApi: () => SidebarStateApi
  setCollapsed: (collapsed: boolean) => void
  collapseSidebar: () => void
  expandSidebar: () => void
  setPanelApi: SidebarStateApi["setPanelApi"]
}

type SidebarHookState = Pick<SidebarState, "isCollapsed">

export const useSidebar = (): HookResult<SidebarHookState, SidebarHookActions> => {
  const isCollapsed = useApplication((state) => state.sidebarState.isCollapsed)

  return {
    state: {
      isCollapsed,
    },
    actions: {
      sidebarApi: sidebarApiProxy,
      setCollapsed: (collapsed: boolean) => getSidebarApi().setCollapsed(collapsed),
      collapseSidebar: () => getSidebarApi().collapseSidebar(),
      expandSidebar: () => getSidebarApi().expandSidebar(),
      setPanelApi: (panel) => getSidebarApi().setPanelApi(panel),
    },
  }
}

type OpenTabsHookState = {
  openTabs: RequestTabState[]
}

type OpenTabsHookActions = {
  requestTabsApi: RequestTabsStateApi
}

export const useOpenTabs = (): HookResult<OpenTabsHookState, OpenTabsHookActions> => {
  const openTabs = useApplication((app) => app.requestTabsState.orderedTabs)

  return {
    state: {
      openTabs,
    },
    actions: {
      requestTabsApi: requestTabsApiProxy,
    },
  }
}

type UtilitySheetsHookState = ReturnType<typeof useApplication>["utilitySheetsState"] & {
  activeSheet: ReturnType<typeof useApplication>["utilitySheetsState"]["stack"][number] | null
}

type UtilitySheetsHookActions = {
  utilitySheetsApi: UtilitySheetsStateApi
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
      utilitySheetsApi: utilitySheetsApiProxy,
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
  requestTabsApi: () => RequestTabsStateApi
}

export function useRequestTab(tabId: string): HookResult<RequestTabHookState, RequestTabHookActions>
export function useRequestTab(tabId?: string): HookResult<RequestTabHookState, RequestTabHookActions> | null
export function useRequestTab(tabId?: string): HookResult<RequestTabHookState, RequestTabHookActions> | null {
  const activeTabId = useActiveTabId()
  const effectiveTabId = tabId ?? activeTabId

  const data = useApplication(
    useShallow((app) => {
      if (!effectiveTabId) {
        return null
      }

      const tab = app.requestTabsState.openTabs[effectiveTabId]
      if (!tab) {
        return null
      }

      const original = app.collectionsState.cache[tab.collectionId]?.requests[tab.requestId]
      if (!original) {
        return null
      }

      // Use pre-computed merged request from tab state, fallback to computing it if not available
      const merged = tab.merged ?? toMergedRequest(original)

      return {
        activeTab: tab,
        request: merged,
        original,
        isDirty: isRequestDirty(original),
      }
    }),
  )

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
      requestTabsApi: requestTabsApiProxy,
    },
  }
}

export type UseRequestsTabSummary = {
  isActive: boolean
  name: string
  method: HttpMethod
  isDirty: boolean
}

export const useRequestsTabSummary = (tabId: string): UseRequestsTabSummary => {
  return useApplication(
    useShallow((app) => {
      const tab = app.requestTabsState.openTabs[tabId]
      assert(tab, `useRequestsTabSummary called with unknown tabId:${tabId}`)
      const collection = app.collectionsState.cache[tab.collectionId]
      assert(collection, `useRequestsTabSummary tab has unknown collectionId:${tab.collectionId}`)
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

      return { isActive, name, method, isDirty }
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
  collection: Pick<CollectionState, "id" | "name">
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
  collection: Pick<CollectionState, "id" | "name">
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
type SettingsHookState = ApplicationState["settingsState"]

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
  theme: ApplicationState["settingsState"]["appearance"]["theme"]
}

type ThemeHookActions = {
  setTheme: (theme: ApplicationState["settingsState"]["appearance"]["theme"]) => void
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
        collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          pathParams: { [id]: updates },
        }),
      removeQueryParam: (id: string) =>
        collectionsApi().updateRequestPatchQueryParam(activeTab.collectionId, activeTab.requestId, id, null),
      removePathParam: (id: string) =>
        collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          pathParams: { [id]: undefined },
        }),
      addQueryParam: () => {
        const id = generateUniqueId(8)
        collectionsApi().updateRequestPatchQueryParam(activeTab.collectionId, activeTab.requestId, id, {})
      },
      addPathParam: () => {
        const id = generateUniqueId(8)
        void collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          pathParams: { [id]: zRequestPathParam.parse({ id }) },
        })
      },
      updateCookieParam: (id: string, updates: Partial<RequestCookieParam>) =>
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, updates),
      removeCookieParam: (id: string) =>
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, null),
      addCookieParam: () => {
        const id = generateUniqueId(8)
        collectionsApi().updateRequestPatchCookieParam(activeTab.collectionId, activeTab.requestId, id, {})
      },
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
  updateRequestPatch: (patch: Partial<RequestState["patch"]>) => void
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
        void collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          body: { content },
        }),
      updateRequestPatch: (patch: Partial<RequestState["patch"]>) =>
        void collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, patch),
      updateFormItem: (id: string, updates: Partial<FormField>) =>
        void collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          body: { formData: { [id]: updates } },
        }),
      removeFormItem: (id: string) =>
        void collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          body: { formData: { [id]: undefined } },
        }),
      addFormItem: () => {
        const id = generateUniqueId(8)
        void collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          body: { formData: { [id]: zFormField.parse({ id }) } },
        })
      },
      formatContent: async () => {
        const formatted = await formatWithPrettier(request.body.content ?? "", request.body.language ?? "text")
        void collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          body: { content: formatted },
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
        collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          options: updates,
        }),
      updateAutoSave: (value: boolean) =>
        collectionsApi().updateRequestPatch(activeTab.collectionId, activeTab.requestId, {
          autoSave: value,
        }),
    },
  }
}
