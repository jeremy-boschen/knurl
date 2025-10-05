// noinspection JSUnusedGlobalSymbols

import { throttle } from "es-toolkit"
import type { StateCreator, StoreApi, StoreMutatorIdentifier } from "zustand"

import type { ApplicationState } from "@/types/application"

/**
 * Interface for slices to provide to the StorageManager when they want to partake in
 * automatic load/save of their state from the file system
 */
export interface StorageProvider<T> {
  key: string // A unique key for this provider, e.g., "collections"
  load: () => Promise<void>
  save: (force?: boolean) => Promise<void>
  shouldSave: (previousSlice: T, currentSlice: T) => boolean
  selector: (state: ApplicationState) => T
  throttleWait?: number
}

/**
 * Manages StorageProvider instances to automatically load/save state in the file system
 */
export interface StorageManager {
  registerStorageProvider<T>(provider: StorageProvider<T>): void
  loadAll(): Promise<void>
  saveAll(): Promise<void>
  registerPostHydrate(cb: () => void | Promise<void>): void
}

type Write<T, U> = Omit<T, keyof U> & U

type WithStorageManager<S> = S extends {
  getState: () => infer T
}
  ? Write<S, StoreStorageManager<T>>
  : never

declare module "zustand" {
  // biome-ignore lint/correctness/noUnusedVariables: Must match zustand StoreMutators type
  interface StoreMutators<S, A> {
    storageManager: WithStorageManager<S>
  }
}

// biome-ignore lint/correctness/noUnusedVariables:<T> is inferred from the store's getState() return type
type StoreStorageManager<T> = {
  registerStorageProvider: StorageManager["registerStorageProvider"]
  loadAll: StorageManager["loadAll"]
  saveAll: StorageManager["saveAll"]
  registerPostHydrate: StorageManager["registerPostHydrate"]
}

type StorageManagerImpl = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, [...Mps, ["storageManager", never]], Mcs>,
) => StateCreator<T, Mps, [["storageManager", never], ...Mcs]>

const storageManagerImpl: StorageManagerImpl = (initializer) => (set, get, store) => {
  // biome-ignore lint/suspicious/noExplicitAny: Required for generic support
  const providers: Map<string, StorageProvider<any>> = new Map()
  const throttledSavers: Map<string, () => void> = new Map()

  const storeWithStorageManager = store as typeof store & StorageManager & StoreApi<ApplicationState>
  const postHydrateCbs: Array<() => void | Promise<void>> = []

  storeWithStorageManager.registerStorageProvider = <T>(provider: StorageProvider<T>) => {
    if (providers.has(provider.key)) {
      console.warn(`[StorageManager] A provider with key "${provider.key}" is already registered.`)
      return
    }
    providers.set(provider.key, provider)

    // Single-window: always set up a throttled saver and subscription
    const throttledSave = throttle(() => {
      console.debug(`[StorageManager] Throttled save triggered for [${provider.key}]`)
      void provider.save()
    }, provider.throttleWait ?? 2000)
    throttledSavers.set(provider.key, throttledSave)

    // Set up the subscription for this provider
    storeWithStorageManager.subscribe((current: ApplicationState, previous: ApplicationState) => {
      const previousSlice = provider.selector(previous)
      const currentSlice = provider.selector(current)
      if (provider.shouldSave(previousSlice, currentSlice)) {
        throttledSave()
      }
    })
  }

  const isStartupProbeEnabled = (): boolean => {
    if (typeof window === "undefined") {
      return false
    }
    const probeWindow = window as Window & { __KNURL_START_PROBE__?: boolean }
    return Boolean(probeWindow.__KNURL_START_PROBE__)
  }

  storeWithStorageManager.loadAll = async () => {
    const shouldTrace = isStartupProbeEnabled()
    const loadStart = shouldTrace ? performance.now() : 0
    await Promise.all(
      Array.from(providers.values()).map(async (provider) => {
        const providerStart = shouldTrace ? performance.now() : 0
        if (shouldTrace) {
          console.info(`[startup] provider:${provider.key} load:start`)
        }
        try {
          await provider.load()
        } finally {
          if (shouldTrace) {
            const duration = performance.now() - providerStart
            console.info(`[startup] provider:${provider.key} load:complete ${duration.toFixed(1)}ms`)
          }
        }
      }),
    )
    if (shouldTrace) {
      const total = performance.now() - loadStart
      console.info(`[startup] storage load complete ${total.toFixed(1)}ms`)
    }
    // Run post-hydration callbacks after providers finish loading
    for (const cb of postHydrateCbs) {
      const cbStart = shouldTrace ? performance.now() : 0
      if (shouldTrace) {
        console.info("[startup] postHydrate:start")
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await cb()
      } catch (e) {
        console.warn("[StorageManager] postHydrate callback failed:", e)
      } finally {
        if (shouldTrace) {
          const duration = performance.now() - cbStart
          console.info(`[startup] postHydrate:complete ${duration.toFixed(1)}ms`)
        }
      }
    }
  }

  storeWithStorageManager.saveAll = async () => {
    await Promise.all(Array.from(providers.values()).map((p) => p.save(true)))
  }

  storeWithStorageManager.registerPostHydrate = (cb: () => void | Promise<void>) => {
    postHydrateCbs.push(cb)
  }

  // Call the original initializer with the enhanced store
  // biome-ignore lint/suspicious/noExplicitAny: OK
  return (initializer as any)(set, get, storeWithStorageManager)
}

export const withStorageManager = storageManagerImpl as unknown as StorageManagerImpl
