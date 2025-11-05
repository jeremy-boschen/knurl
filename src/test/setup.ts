// Vitest + RTL setup
// noinspection JSUnusedGlobalSymbols

import "@testing-library/jest-dom/vitest"

import { vi, beforeEach, afterEach } from "vitest"
import { randomFillSync, randomUUID as nodeRandomUUID } from "node:crypto"

vi.mock("@tauri-apps/api/mocks", () => {
  let handler: (cmd: string, payload: unknown) => unknown | Promise<unknown> = () => null

  const ensureInternals = () => {
    const internals = (window as any).__TAURI_INTERNALS__ ?? {}
    internals.invoke = async (cmd: string, payload: unknown) => {
      return await handler(cmd, payload)
    }
    internals.transformCallback =
      internals.transformCallback ?? ((_cb: unknown, _once: boolean, callback: any) => callback)
    internals.event = internals.event ?? {
      emit: async () => {},
      listen: async () => () => {},
    }
    ;(window as any).__TAURI_INTERNALS__ = internals
  }

  const mockIPC = (fn: typeof handler = () => null) => {
    handler = fn
    ensureInternals()
    return () => {
      handler = () => null
      ensureInternals()
    }
  }

  const clearMocks = () => {
    handler = () => null
    ensureInternals()
  }

  ensureInternals()

  return { mockIPC, clearMocks }
})

vi.mock("@tauri-apps/api", () => ({
  window: {
    getCurrentWindow: vi.fn(() => ({
      label: "main",
    })),
  },
  webview: {
    getCurrentWebview: vi.fn(() => ({
      label: "main",
    })),
  },
  event: {
    emit: vi.fn(),
    listen: vi.fn(() => () => {}),
  },
}))

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    label: "main",
    // @ts-expect-error test-only skip flag mirrored from real API internal
    skip: true,
    onCloseRequested: vi.fn(async (_cb: any) => {
      return () => {}
    }),
    // Minimal API used by AppLayout/useTauriWindowSize
    innerSize: vi.fn(async () => ({ width: 1200, height: 800 })),
    onResized: vi.fn(async (_cb: any) => {
      return () => {}
    }),
  })),
}))

import { clearMocks, mockIPC } from "@tauri-apps/api/mocks"
import { enablePatches } from "immer"
// Enable Immer patches for tests that use produceWithPatches
enablePatches()
// ---------------------------------------------------------------------------
// Tauri v2: Prefer @tauri-apps/api/mocks to intercept IPC and reset state.
// Reference: https://v2.tauri.app/develop/tests/mocking/
// ---------------------------------------------------------------------------

// Optional: silence React 19 act warnings in tests if any specific setup is needed
// You can extend here with common mocks (e.g., window.matchMedia) if components rely on them.

// Example minimal mock for matchMedia used by some libs
if (!window.matchMedia) {
  ;(window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// Shim ResizeObserver for jsdom (used by Radix UI internals)
if (typeof (window as any).ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(window as any).ResizeObserver = ResizeObserver as any
}

// Workaround for Radix UI + jsdom `hasPointerCapture` error
if (typeof (window as any).HTMLElement.prototype.hasPointerCapture === "undefined") {
  ;(window as any).HTMLElement.prototype.hasPointerCapture = () => false
}

// Workaround for Radix UI + jsdom `scrollIntoView` error
if (typeof (window as any).HTMLElement.prototype.scrollIntoView === "undefined") {
  ;(window as any).HTMLElement.prototype.scrollIntoView = () => {}
}

const ensureTauriInternals = () => {
  const internals = (window as any).__TAURI_INTERNALS__ ?? {}
  if (typeof internals.invoke !== "function") {
    internals.invoke = async () => null
  }
  if (typeof internals.transformCallback !== "function") {
    internals.transformCallback = (_cb, _once, callback) => callback
  }
  ;(window as any).__TAURI_INTERNALS__ = internals
}

// Ensure the Tauri IPC bridge exists before modules import side-effectful stores.
if (!(window as any).__TAURI_INTERNALS__) {
  mockIPC(() => {}, { shouldMockEvents: true })
  ensureTauriInternals()
}

// jsdom doesn't ship a WebCrypto getRandomValues implementation compatible with Tauri
if (!(window as any).crypto || typeof (window as any).crypto.getRandomValues !== "function") {
  Object.defineProperty(window, "crypto", {
    value: {
      getRandomValues: (buffer: Uint8Array) => randomFillSync(buffer),
    },
  })
}

// Ensure crypto.randomUUID exists for modules that rely on it
if ((window as any).crypto && typeof (window as any).crypto.randomUUID !== "function") {
  ;(window as any).crypto.randomUUID = nodeRandomUUID as any
}

// BroadcastChannel polyfill no longer needed (single-window, no BC middleware)

beforeEach(() => {
  // Intercept all invoke() calls by default; tests can reconfigure per-case.
  mockIPC(() => {}, { shouldMockEvents: true })
  ensureTauriInternals()
})

afterEach(() => {
  // Reset Tauri mocks between tests to avoid state bleed.
  clearMocks()
})
