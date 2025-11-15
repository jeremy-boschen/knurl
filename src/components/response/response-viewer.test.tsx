import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import ResponseViewer from "./response-viewer"

const mocks = vi.hoisted(() => ({
  useRequestTab: vi.fn(),
}))

vi.mock("@/state", () => ({
  useRequestTab: mocks.useRequestTab,
}))

const saveFile = vi.fn()
const saveBinary = vi.fn()

vi.mock("@/bindings/knurl", () => ({
  saveBinary: (...args: any[]) => saveBinary(...args),
  saveFile: (...args: any[]) => saveFile(...args),
}))

const openPath = vi.fn()
const revealItemInDir = vi.fn()

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: (...args: any[]) => openPath(...args),
  revealItemInDir: (...args: any[]) => revealItemInDir(...args),
}))

vi.mock("@/components/editor/code-viewer", () => ({
  CodeViewer: ({ value }: { value: string }) => <div data-testid="code-viewer">{value}</div>,
}))

vi.mock("./components", () => ({
  HeadersList: () => <div data-testid="headers-list" />,
  CookieList: () => <div data-testid="cookies-list" />,
  LogsList: () => <div data-testid="logs-list" />,
}))

vi.mock("@/lib/prettier", () => ({
  warmPrettier: vi.fn(),
}))

const buildResponse = (overrides: Partial<Record<string, unknown>> = {}) => {
  return {
    requestId: "req-1",
    responseTime: 123,
    responseSize: 2048,
    timestamp: new Date().toISOString(),
    logs: [
      {
        requestId: "req-1",
        timestamp: new Date().toISOString(),
        level: "info",
        message: "done",
      },
    ],
    data: {
      type: "http" as const,
      data: {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "application/json",
        },
        cookies: [],
        body: "{\"ok\":true}",
        bodyBase64: undefined,
        filePath: undefined,
        ...overrides,
      },
    },
  }
}

const buildRequestTab = (responseOverrides: Partial<Record<string, unknown>> = {}) => {
  const response = buildResponse(responseOverrides)
  return {
    state: {
      activeTab: {
        tabId: "tab-1",
        response,
      },
      request: {
        id: "req-1",
        url: "https://api.knurl.dev",
        method: "GET",
      },
      original: {
        id: "req-1",
        url: "https://api.knurl.dev",
        method: "GET",
      },
    },
    actions: {
      requestTabsApi: {
        setResponseLogFilter: vi.fn(),
      },
    },
  }
}

const getByTestId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}

describe("ResponseViewer", () => {
  beforeEach(() => {
    mocks.useRequestTab.mockReset()
    saveFile.mockReset()
    saveBinary.mockReset()
    openPath.mockReset()
    revealItemInDir.mockReset()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const mockNavigator = {
      clipboard: { writeText },
      userAgent: "vitest",
      language: "en-US",
    }
    Object.defineProperty(window, "navigator", {
      value: mockNavigator,
      configurable: true,
    })
    ;(global as any).__clipboardSpy = writeText
  })

  it("copies body text and saves the response", async () => {
    const tab = buildRequestTab()
    mocks.useRequestTab.mockReturnValue(tab)
    saveFile.mockResolvedValue(undefined)
    const { rerender } = render(<ResponseViewer tabId="tab-1" className="" />)

    const user = userEvent.setup()
    await user.click(getByTestId("response-viewer:copy-body-button"))

    await user.click(getByTestId("response-viewer:save-button"))
    expect(saveFile).toHaveBeenCalledWith("{\"ok\":true}", expect.objectContaining({ title: "Save Response" }))

    // Rerender to ensure component remains stable
    rerender(<ResponseViewer tabId="tab-1" className="custom" />)
    expect(getByTestId("response-viewer:heading")).toBeTruthy()
  })

  it("shows binary preview actions and opens saved files", async () => {
    const tab = buildRequestTab({
      headers: { "content-type": "image/png" },
      body: undefined,
      bodyBase64: "ZmFrZSBiYXNlNjQ=",
      filePath: "/tmp/image.png",
    })
    mocks.useRequestTab.mockReturnValue(tab)
    render(<ResponseViewer tabId="tab-1" className="" />)

    const user = userEvent.setup()
    await user.click(getByTestId("response-viewer:body-open-file-button"))
    expect(openPath).toHaveBeenCalledWith("/tmp/image.png")
    await user.click(getByTestId("response-viewer:body-reveal-file-button"))
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/image.png")
  })

  it("returns null when no response is available", () => {
    mocks.useRequestTab.mockReturnValue({
      state: {
        activeTab: { tabId: "tab-1", response: null },
        request: null,
        original: null,
      },
      actions: { requestTabsApi: null },
    })
    const { container } = render(<ResponseViewer tabId="tab-1" className="" />)
    expect(container.firstChild).toBeNull()
  })
})
