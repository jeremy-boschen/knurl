import type { CodeLanguage } from "@/types"
import PrettierWorker from "../worker/prettier.worker.ts?worker"

let worker: Worker | null = null
let workerFailed = false
let seq = 1
const pending = new Map<number, (s: string) => void>()

function getWorker(): Worker | null {
  if (workerFailed) {
    return null
  }
  if (worker) {
    return worker
  }
  if (typeof globalThis.Worker !== "function") {
    workerFailed = true
    return null
  }
  try {
    // Use relative path for Vite/Tauri worker resolution; aliases like @ can break in workers
    worker = new PrettierWorker({ type: "module" })
    // biome-ignore lint/suspicious/noExplicitAny: OK
    worker.onmessage = (e: MessageEvent<any>) => {
      const { id, ok, formatted } = e.data
      const res = pending.get(id)
      if (res) {
        pending.delete(id)
        res(ok ? formatted : formatted /* return original on error */)
      }
    }
    worker.onerror = () => {
      // Fail all in-flight calls by returning original
      for (const [, resolve] of pending) {
        resolve("")
      }
      pending.clear()
      workerFailed = true
      worker = null
    }
  } catch (err) {
    // If worker cannot be created (e.g., due to CSP or path), disable formatting gracefully
    console.error("Prettier worker failed to start:", err)
    for (const [, resolve] of pending) {
      resolve("")
    }
    pending.clear()
    workerFailed = true
    worker = null
  }
  return worker
}

export function warmPrettier(languages?: CodeLanguage[]) {
  const w = getWorker()
  if (w) {
    w.postMessage({ type: "warmup", languages })
  }
}

export function formatWithPrettier(
  code: string,
  language: CodeLanguage,
  // biome-ignore lint/suspicious/noExplicitAny: OK
  options?: Record<string, any>,
): Promise<string> {
  const w = getWorker()
  if (!w) {
    return Promise.resolve(code)
  }
  const id = seq++
  return new Promise((resolve) => {
    pending.set(id, (out) => resolve(out || code))
    w.postMessage({ id, code, language, options })
  })
}
