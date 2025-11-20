import React from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

const pluginLogMocks = vi.hoisted(() => ({
  attachConsole: vi.fn().mockResolvedValue(undefined),
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock("@tauri-apps/plugin-log", () => pluginLogMocks)

const immerMocks = vi.hoisted(() => ({
  enablePatches: vi.fn(),
}))

vi.mock("immer", () => immerMocks)

const startupStateMocks = vi.hoisted(() => ({
  getStartupState: vi.fn().mockReturnValue(0),
  setStartupState: vi.fn(),
}))

vi.mock("@/lib/startup-state", () => startupStateMocks)

const stateMocks = vi.hoisted(() => ({
  loadApplication: vi.fn(),
}))

vi.mock("@/state", () => stateMocks)

const suspenseMocks = vi.hoisted(() => {
  const resource = { read: vi.fn() }
  return {
    resource,
    asSuspense: vi.fn(() => resource),
  }
})

vi.mock("@/state/utils", () => ({
  asSuspense: suspenseMocks.asSuspense,
}))

const renderMock = vi.fn()
const createRootMock = vi.fn(() => ({ render: renderMock }))

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}))

vi.mock("./App", () => ({
  __esModule: true,
  default: () => React.createElement("div", { "data-test-id": "app" }),
}))

const originalConsole = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

describe("index bootstrap", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="root"></div>'
    console.log = originalConsole.log
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  afterEach(() => {
    console.log = originalConsole.log
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  it("initializes tauri logging + hydration before rendering", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    try {
      const module = await import("./index")
      expect(immerMocks.enablePatches).toHaveBeenCalledTimes(1)
      expect(pluginLogMocks.attachConsole).toHaveBeenCalledTimes(1)
      const rootEl = document.getElementById("root")
      expect(createRootMock).toHaveBeenCalledWith(rootEl)
      expect(renderMock).toHaveBeenCalledTimes(1)
      expect(suspenseMocks.asSuspense).toHaveBeenCalledWith(stateMocks.loadApplication)
      expect(module.hydrationResource).toBe(suspenseMocks.resource)

      console.log("hello", 42)
      expect(consoleSpy).toHaveBeenCalledWith("hello", 42)
    } finally {
      consoleSpy.mockRestore()
    }
  }, 15000)

  it("renders StrictMode>Suspense>Root and advances startup state", async () => {
    const module = await import("./index")
    const renderArg = renderMock.mock.calls[0][0] as React.ReactElement

    expect(renderArg.type).toBe(React.StrictMode)
    const suspenseElement = renderArg.props.children as React.ReactElement
    expect(suspenseElement.type).toBe(React.Suspense)
    const rootElement = suspenseElement.props.children as React.ReactElement
    const RootComponent = rootElement.type as React.ComponentType

    expect(startupStateMocks.setStartupState).toHaveBeenNthCalledWith(1, 0)
    startupStateMocks.getStartupState.mockReturnValueOnce(0)
    RootComponent({})
    expect(startupStateMocks.getStartupState).toHaveBeenCalled()
    expect(startupStateMocks.setStartupState).toHaveBeenLastCalledWith(1)
    expect(suspenseMocks.resource.read).toHaveBeenCalled()
  })
})
