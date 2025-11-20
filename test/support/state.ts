/**
 * State helpers for INTEGRATION TESTS ONLY.
 *
 * ⚠️  WARNING: These functions use bridge methods to access internal state.
 *     They should ONLY be used in integration tests (test/specs/integration/).
 *
 * E2E tests should use UI interactions only. See CLAUDE.md for the golden rule.
 */

import { callBridgeReplacement } from "./bridge-replacement"

type SeedCollectionArgs = {
  collectionName: string
  requestName: string
  requestUrl?: string
}

type SeedCollectionResult = {
  collectionId: string
  requestId: string
  tabKey: string | null
  index: Array<Record<string, unknown>>
}

/**
 * Integration test helper: Reset collections state via bridge access.
 *
 * ⚠️  DO NOT USE IN E2E TESTS. This violates the E2E golden rule.
 * Use only in test/specs/integration/ tests.
 */
export async function resetCollectionsState(): Promise<void> {
  await browser.executeAsync(
    async (done: (value: { ok: boolean; error?: string }) => void) => {
      try {
        const modules = (window as any).__vite_ssr_modules__
        if (!modules) {
          throw new Error("App modules not available - app may not be fully hydrated")
        }

        const appModule = Object.values(modules).find((mod: any) => {
          return mod && mod.useApplication && typeof mod.useApplication === 'function'
        }) as any

        if (!appModule?.useApplication) {
          throw new Error("Application module not found")
        }

        const collectionsModule = Object.values(modules).find((mod: any) => {
          return mod && mod.ScratchCollectionId !== undefined
        }) as any

        const { ScratchCollectionId } = collectionsModule || {}
        if (!ScratchCollectionId) {
          throw new Error("ScratchCollectionId not found in collections module")
        }

        const api = appModule.useApplication.getState()
        const collectionsApi = api.collectionsApi?.()
        if (!collectionsApi) {
          throw new Error("Collections API not available")
        }

        const index = collectionsApi.getCollectionsIndex()
        for (const entry of index) {
          if (entry.id === ScratchCollectionId) {
            continue
          }
          collectionsApi.removeCollection(entry.id)
        }
        done({ ok: true })
      } catch (error) {
        console.error("resetCollectionsState failed", error)
        done({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  )

  await callBridgeReplacement("flushStorage")
}

/**
 * Integration test helper: Seed a collection with an open request via bridge access.
 *
 * ⚠️  DO NOT USE IN E2E TESTS. This violates the E2E golden rule.
 * Use only in test/specs/integration/ tests.
 */
export async function seedCollectionWithOpenRequest({
  collectionName,
  requestName,
  requestUrl = "https://example.com/",
}: SeedCollectionArgs): Promise<SeedCollectionResult> {
  const result = await browser.executeAsync(
    async (
      args: SeedCollectionArgs,
      done: (value: { ok: true; data: SeedCollectionResult } | { ok: false; error: string }) => void,
    ) => {
      try {
        const modules = (window as any).__vite_ssr_modules__
        if (!modules) {
          throw new Error("App modules not available - app may not be fully hydrated")
        }

        const appModule = Object.values(modules).find((mod: any) => {
          return mod && mod.useApplication && typeof mod.useApplication === 'function'
        }) as any

        if (!appModule?.useApplication) {
          throw new Error("Application module not found")
        }

        const stateBefore = appModule.useApplication.getState()
        const { requestTabsApi } = stateBefore
        const collectionsApi = stateBefore.collectionsApi?.()

        if (!collectionsApi) {
          throw new Error("Collections API not available")
        }

        if (!requestTabsApi) {
          throw new Error("Request tabs API not available")
        }

        const collection = collectionsApi.addCollection(args.collectionName)
        const request = collectionsApi.createRequest(collection.id, {
          name: args.requestName,
          url: args.requestUrl,
        })

        requestTabsApi.openRequestTab(collection.id, request.id)
        const stateAfter = appModule.useApplication.getState()
        const tabKey = stateAfter.requestTabsState.activeTab ?? null
        const indexSnapshot = stateAfter.collectionsState.index.map((entry) => ({ ...entry }))

        collectionsApi.saveCollection(collection.id)

        done({
          ok: true,
          data: {
            collectionId: collection.id,
            requestId: request.id,
            tabKey,
            index: indexSnapshot,
          },
        })
      } catch (error) {
        console.error("seedCollectionWithOpenRequest failed", error)
        done({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    { collectionName, requestName, requestUrl },
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.data
}
