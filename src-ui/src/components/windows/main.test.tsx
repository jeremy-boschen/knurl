import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest"

const deleteFileMock = vi.fn()
vi.mock("@/bindings/knurl", () => ({ deleteFile: deleteFileMock }))

const closeHandlers: Array<() => Promise<void> | void> = []
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: (handler: () => Promise<void> | void) => {
      closeHandlers.push(handler)
      return Promise.resolve(() => {})
    },
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
  settingsState: { requests: { autoSave: 30 } },
}

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
    actions: { settingsApi: () => ({}) },
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
let setTimeoutSpy: ReturnType<typeof vi.spyOn>

beforeAll(async () => {
  vi.useFakeTimers()
  setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
    if (typeof fn === "function") {
      fn()
    }
    return 0 as unknown as number
  })
  ;({ MainWindow } = await import("./main"))
})

afterAll(() => {
  setTimeoutSpy.mockRestore()
  vi.useRealTimers()
})

beforeEach(() => {
  closeHandlers.length = 0
  intervalCallback = null
  intervalMock.mockClear()
  deleteFileMock.mockReset()
  saveAllMock.mockClear()
  getStateMock.mockReturnValue({
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
})
