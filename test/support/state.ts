import { callBridge } from "./e2e-bridge"

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

export async function resetCollectionsState(): Promise<void> {
  const result = await browser.executeAsync(
    async (done: (value: { ok: boolean; error?: string }) => void) => {
      try {
        const app = await import("/src/state/application")
        const { ScratchCollectionId } = await import("/src/state/collections")
        const index = app.collectionsApi().getCollectionsIndex()
        for (const entry of index) {
          if (entry.id === ScratchCollectionId) {
            continue
          }
          app.collectionsApi().removeCollection(entry.id)
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

  if (!result.ok) {
    throw new Error(result.error ?? "resetCollectionsState failed")
  }

  await callBridge("flushStorage")
}

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
        const app = await import("/src/state/application")
        const { collectionsApi } = app
        const stateBefore = app.useApplication.getState()
        const { requestTabsApi } = stateBefore

        const collection = collectionsApi().addCollection(args.collectionName)
        const request = collectionsApi().createRequest(collection.id, {
          name: args.requestName,
          url: args.requestUrl,
        })

        requestTabsApi.openRequestTab(collection.id, request.id)
        const stateAfter = app.useApplication.getState()
        const tabKey = stateAfter.requestTabsState.activeTab ?? null
        const indexSnapshot = stateAfter.collectionsState.index.map((entry) => ({ ...entry }))

        collectionsApi().saveCollection(collection.id)

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
