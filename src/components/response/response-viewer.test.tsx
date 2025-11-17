import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const stateMocks = vi.hoisted(() => ({
  useRequestTab: vi.fn(),
}))

const { useRequestTab } = stateMocks

vi.mock("@/state", () => stateMocks)

vi.mock("@/bindings/knurl", () => ({
  saveFile: vi.fn(async () => ({})),
  saveBinary: vi.fn(async () => ({})),
}))

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(async () => {}),
  revealItemInDir: vi.fn(async () => {}),
}))

vi.mock("@/components/editor/code-viewer", () => ({
  CodeViewer: ({ value }: { value: string }) => <pre data-testid="mock-code-viewer">{value}</pre>,
}))

import ResponseViewer from "./response-viewer"
import { saveFile } from "@/bindings/knurl"
import { openPath } from "@tauri-apps/plugin-opener"

const baseHttpData = {
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  body: '{"hello":"world"}',
  cookies: [],
}

const mockRequestState = {
  url: "https://api.example.com",
}

type RenderOptions = {
  httpData?: Record<string, any>
  responseOverrides?: Record<string, any>
}

const renderViewer = (options: RenderOptions = {}) => {
  const httpData = { ...baseHttpData, ...options.httpData }
  if (!httpData.cookies) {
    httpData.cookies = []
  }
  const response: any = {
    requestId: "req-1",
    responseTime: 123,
    responseSize: 1024,
    timestamp: new Date().toISOString(),
    logs: [],
    ...options.responseOverrides,
  }
  if (!response.data) {
    response.data = { type: "http" as const, data: httpData }
  }

  useRequestTab.mockReturnValue({
    state: {
      activeTab: { response },
      request: mockRequestState,
    },
    actions: { requestTabsApi: {} },
  })

  return render(<ResponseViewer tabId="tab-1" className="" />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ResponseViewer", () => {
  it("renders status metadata", () => {
    renderViewer()
    expect(screen.getByText(/Response/)).toBeInTheDocument()
    expect(screen.getByText(/200/)).toBeInTheDocument()
  })

  it("saves response bodies", async () => {
    const user = userEvent.setup()
    renderViewer()

    await user.click(await screen.findByRole("button", { name: /save/i }))
    expect(saveFile).toHaveBeenCalled()
  })

  it("renders nothing if response is missing", () => {
    useRequestTab.mockReturnValue({
      state: { activeTab: { response: null }, request: mockRequestState },
      actions: { requestTabsApi: {} },
    })
    const { container } = render(<ResponseViewer tabId="tab-1" className="" />)
    expect(container).toBeEmptyDOMElement()
  })
})
