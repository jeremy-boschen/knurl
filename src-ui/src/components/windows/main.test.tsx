import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest"

const deleteFileMock = vi.fn()
vi.mock("@/bindings/knurl", () => ({ deleteFile: deleteFileMock }))

const closeHandlers: Array<() => Promise<void> | void> = []
const moveHandlers: Array<() => Promise<void> | void> = []
const resizeHandlers: Array<() => Promise<void> | void> = []
const isMinimizedMock = vi.fn().mockResolvedValue(false)
const isMaximizedMock = vi.fn().mockResolvedValue(false)
const positionMock = vi.fn().mockResolvedValue({ x: 10, y: 20 })
const sizeMock = vi.fn().mockResolvedValue({ width: 1234, height: 900 })
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: (handler: () => Promise<void> | void) => {
      closeHandlers.push(handler)
      return Promise.resolve(() => {})
    },
    onMoved: (handler: () => Promise<void> | void) => {
      moveHandlers.push(handler)
      return Promise.resolve(() => {})
    },
    onResized: (handler: () => Promise<void> | void) => {
      resizeHandlers.push(handler)
      return Promise.resolve(() => {})
    },
    isMinimized: isMinimizedMock,
    isMaximized: isMaximizedMock,
    outerPosition: positionMock,
    outerSize: sizeMock,
  }),
}))

const intervalMock = vi.fn()
let intervalCallback: (() => Promise<void> | void) | null = null
vi.mock("@/hooks/use-interval", () => ({
  useInterval: (cb: () => Promise<void> | void, delay: number) => {
    intervalCallback = cb
    intervalMock(cb, delay)
  },
}))

const saveAllMock = vi.fn().mockResolvedValue(undefined)
const getStateMock = vi.fn()
const appState = {
  settingsState: { requests: { autoSave: 30 }, windows: {} },
}
const setWindowStateMock = vi.fn()

const useApplicationMock: any = Object.assign(
  (selector?: (state: typeof appState) => unknown) => (selector ? selector(appState as any) : appState),
  {
    saveAll: saveAllMock,
    getState: getStateMock,
    loadAll: vi.fn(),
  },
)

vi.mock("@/state", () => ({
  useApplication: useApplicationMock,
  useSettings: () => ({
    state: appState.settingsState,
    actions: { settingsApi: () => ({ setWindowState: setWindowStateMock }) },
  }),
}))

vi.mock("wouter", () => ({
  Switch: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ component: Component }: { component: React.ComponentType }) => <Component />,
}))

vi.mock("@/pages/home", () => ({
  default: () => <div data-testid="home-page">Home</div>,
}))

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

let MainWindow: typeof import("./main").MainWindow

beforeAll(async () => {
  ;({ MainWindow } = await import("./main"))
})

afterAll(() => {
})

beforeEach(() => {
  closeHandlers.length = 0
  moveHandlers.length = 0
  resizeHandlers.length = 0
  intervalCallback = null
  intervalMock.mockClear()
  deleteFileMock.mockReset()
  saveAllMock.mockClear()
  setWindowStateMock.mockClear()
  isMinimizedMock.mockResolvedValue(false)
  isMaximizedMock.mockResolvedValue(false)
  positionMock.mockResolvedValue({ x: 10, y: 20 })
  sizeMock.mockResolvedValue({ width: 1234, height: 900 })
  getStateMock.mockReturnValue({
    settingsState: appState.settingsState,
    requestTabsState: {
      openTabs: {
        "tab-1": {
          response: { data: { type: "http", data: { filePath: "/tmp/response.bin" } } },
        },
        "tab-2": {
          response: { data: { type: "websocket" } },
        },
      },
    },
  })
})

describe("MainWindow", () => {
  it("registers auto-save using the configured interval and runs saveAll", async () => {
    appState.settingsState.requests.autoSave = 45
    render(<MainWindow />)

    expect(intervalMock).toHaveBeenCalledWith(expect.any(Function), 45000)
    await intervalCallback?.()
    expect(saveAllMock).toHaveBeenCalledTimes(1)
  })

  it("cleans up temp files and saves when the window close event fires", async () => {
    render(<MainWindow />)
    expect(closeHandlers).toHaveLength(1)

    await closeHandlers[0]?.()

    expect(deleteFileMock).toHaveBeenCalledWith("/tmp/response.bin")
    expect(saveAllMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("toaster")).toBeInTheDocument()
  })

  it("records window geometry on move/resize events", async () => {
    render(<MainWindow />)

    await waitFor(() => expect(setWindowStateMock).toHaveBeenCalledTimes(1))

    // Initial sync + handlers
    expect(setWindowStateMock).toHaveBeenCalledWith("main", {
      x: 10,
      y: 20,
      width: 1234,
      height: 900,
      isMaximized: false,
    })

    await moveHandlers[0]?.()
    await resizeHandlers[0]?.()

    await waitFor(() => expect(setWindowStateMock).toHaveBeenCalledTimes(3))
  })

  it("retains last restored geometry when maximized", async () => {
    appState.settingsState.windows = {
      main: { x: 50, y: 60, width: 800, height: 600, isMaximized: false },
    }
    isMaximizedMock.mockResolvedValue(true)
    sizeMock.mockResolvedValue({ width: 1920, height: 1080 })
    positionMock.mockResolvedValue({ x: 0, y: 0 })

    render(<MainWindow />)
    await waitFor(() => expect(setWindowStateMock).toHaveBeenCalledTimes(1))

    expect(setWindowStateMock).toHaveBeenCalledWith("main", {
      x: 50,
      y: 60,
      width: 800,
      height: 600,
      isMaximized: true,
    })
  })
})
