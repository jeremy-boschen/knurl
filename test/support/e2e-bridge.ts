import type { KnurlE2EBridge, WorkspaceSnapshot } from "../../src/test/e2e-bridge"

type BridgeCallResponse<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: string
    }

export async function ensureBridgeReady(timeout = 30000): Promise<void> {
  await browser.waitUntil(
    async () =>
      await browser.execute(() => {
        return typeof window !== "undefined" && !!(window as unknown as { __KNURL_E2E__?: KnurlE2EBridge }).__KNURL_E2E__
      }),
    {
      timeout,
      interval: 200,
      timeoutMsg: "Timed out waiting for Knurl e2e bridge",
    },
  )
}

export async function callBridge<M extends keyof KnurlE2EBridge>(
  method: M,
  ...args: Parameters<KnurlE2EBridge[M]>
): Promise<Awaited<ReturnType<KnurlE2EBridge[M]>>> {
  const outcome = (await browser.executeAsync(
    (name: M, payload: Parameters<KnurlE2EBridge[M]>, done: (result: BridgeCallResponse<unknown>) => void) => {
      try {
        const bridge = (window as unknown as { __KNURL_E2E__?: KnurlE2EBridge }).__KNURL_E2E__
        if (!bridge || typeof bridge[name] !== "function") {
          done({
            ok: false,
            error: `Bridge method ${String(name)} unavailable`,
          })
          return
        }

        Promise.resolve((bridge[name] as (...arguments_: Parameters<KnurlE2EBridge[M]>) => unknown)(...payload))
          .then((value) => done({ ok: true, value }))
          .catch((error: unknown) =>
            done({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          )
      } catch (error) {
        done({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    method,
    args,
  )) as BridgeCallResponse<Awaited<ReturnType<KnurlE2EBridge[M]>>>

  if (!outcome.ok) {
    throw new Error(`Bridge call ${String(method)} failed: ${outcome.error}`)
  }

  return outcome.value
}

export type { WorkspaceSnapshot }
