import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const stateMocks = vi.hoisted(() => ({
  useRequestTab: vi.fn(),
}))

const { useRequestTab } = stateMocks
const requestTabsApi = {
  setResponseLogFilter: vi.fn(),
}

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

vi.mock("./components", () => ({
  CookieList: ({ cookies }: { cookies: Array<Record<string, string>> }) => (
    <div data-test-id="mock-cookie-list">Cookies:{cookies.length}</div>
  ),
  HeadersList: ({ headers }: { headers: Record<string, string> }) => (
    <div data-test-id="mock-headers-list">Headers:{Object.keys(headers).length}</div>
  ),
  LogsList: ({ logs, onSelectedLevelsChange }: { logs: any[]; onSelectedLevelsChange?: (levels: string[]) => void }) => (
    <div data-test-id="mock-logs-list">
      Logs:{logs.length}
      <button
        type="button"
        data-test-id="mock-logs-filter-button"
        onClick={() => onSelectedLevelsChange?.(["error"])}
      >
        Narrow
      </button>
    </div>
  ),
}))

import ResponseViewer from "./response-viewer"
import { saveBinary, saveFile } from "@/bindings/knurl"
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener"

const getByDataTestId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Element with data-test-id=${id} not found`)
  }
  return el as HTMLElement
}

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

const clipboardWriteMock = vi.fn(async () => {})

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
    actions: { requestTabsApi },
  })

  return render(<ResponseViewer tabId="tab-1" className="" />)
}

beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWriteMock },
    configurable: true,
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  clipboardWriteMock.mockClear()
  requestTabsApi.setResponseLogFilter.mockClear()
  ;(navigator as any).clipboard.writeText = clipboardWriteMock
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
      actions: { requestTabsApi },
    })
    const { container } = render(<ResponseViewer tabId="tab-1" className="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("saves binary responses via saveBinary and exposes preview file actions", async () => {
    const user = userEvent.setup()
    renderViewer({
      httpData: {
        headers: { "content-type": "image/png" },
        bodyBase64: "ZmFrZS1kYXRh",
        filePath: "/tmp/image.png",
      },
    })

    await user.click(screen.getByRole("button", { name: /save/i }))
    expect(saveBinary).toHaveBeenCalledWith("ZmFrZS1kYXRh", expect.any(Object))

    await user.click(screen.getByRole("tab", { name: /Preview/i }))
    const previewPanel = await screen.findByRole("tabpanel", { name: /Preview/i })
    await user.click(within(previewPanel).getByTitle("Open saved response file"))
    expect(openPath).toHaveBeenCalledWith("/tmp/image.png")
    await user.click(within(previewPanel).getByTitle("Reveal in file manager"))
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/image.png")
  })

  it("copies response text or base64 via the copy button", async () => {
    const user = userEvent.setup()

    renderViewer({
      httpData: {
        headers: { "content-type": "image/png" },
        bodyBase64: "YmFzZTY0LWJvZHk=",
      },
    })

    const bodyPanel = await screen.findByRole("tabpanel", { name: /Body/i })
    await user.click(within(bodyPanel).getByRole("button", { name: /^Copy$/i }))
    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalledWith("YmFzZTY0LWJvZHk=")
    })
  })

  it("copies plain text bodies via the copy button", async () => {
    const user = userEvent.setup()
    renderViewer({
      httpData: {
        headers: { "content-type": "text/plain" },
        body: "hello world",
      },
    })

    const bodyPanel = await screen.findByRole("tabpanel", { name: /Body/i })
    await user.click(within(bodyPanel).getByRole("button", { name: /^Copy$/i }))
    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalledWith("hello world")
    })
  })

  it("toggles formatted view for structured responses", async () => {
    const user = userEvent.setup()
    renderViewer()

    const formatButton = await waitFor(() => getByDataTestId("response-viewer:format-toggle-button"))
    await waitFor(() => expect(formatButton).not.toBeDisabled())
    await user.click(formatButton)
    expect(formatButton.textContent).toMatch(/Restore/)
  })

  it("renders cookies, headers, and logs tabs and forwards log filter updates", async () => {
    const user = userEvent.setup()
    renderViewer({
      httpData: {
        ...baseHttpData,
        cookies: [{ name: "sid", value: "1" }],
      },
      responseOverrides: {
        logs: [{ timestamp: Date.now(), level: "info", message: "ok" }],
        logFilterLevels: ["info"],
      },
    })

    await user.click(screen.getByRole("tab", { name: /Headers/i }))
    const headersPanel = await screen.findByRole("tabpanel", { name: /Headers/i })
    expect(within(headersPanel).getByText(/Headers:1/)).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Cookies/i }))
    const cookiesPanel = await screen.findByRole("tabpanel", { name: /Cookies/i })
    expect(within(cookiesPanel).getByText(/Cookies:1/)).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Logs/i }))
    const logsPanel = await screen.findByRole("tabpanel", { name: /Logs/i })
    expect(within(logsPanel).getByText(/Logs:1/)).toBeInTheDocument()
    await user.click(within(logsPanel).getByRole("button", { name: /narrow/i }))
    expect(requestTabsApi.setResponseLogFilter).toHaveBeenCalledWith("tab-1", ["error"])
  })

  it("applies status color classes for non-2xx responses", () => {
    renderViewer({
      httpData: { ...baseHttpData, status: 404, statusText: "Not Found" },
    })
    const statusEl = getByDataTestId("response-panel:status-code")
    expect(statusEl.className).toContain("text-warning")
  })

  it("displays formatted size for zero-byte responses", () => {
    renderViewer({
      responseOverrides: { responseSize: 0 },
    })
    expect(screen.getByText("0 B")).toBeInTheDocument()
  })

  it("turns off formatted view when language changes", async () => {
    const user = userEvent.setup()
    renderViewer()

    const formatButton = await waitFor(() => getByDataTestId("response-viewer:format-toggle-button"))
    await user.click(formatButton)
    expect(formatButton.textContent).toMatch(/Restore/)

    const languageSelect = getByDataTestId("response-viewer:language-select")
    await user.click(languageSelect)
    await user.click(await screen.findByRole("option", { name: "XML" }))

    await waitFor(() => expect(getByDataTestId("response-viewer:format-toggle-button").textContent).toMatch(/Format/))
  })

  it("shows error status when logs contain errors and no http response", async () => {
    renderViewer({
      responseOverrides: {
        data: { type: "error", data: null },
        logs: [{ level: "error", message: "boom", timestamp: Date.now() }],
      },
      httpData: undefined,
    })

    const status = await waitFor(() => getByDataTestId("response-panel:status-code"))
    expect(status.textContent).toContain("Error")
    expect(screen.queryByTestId("response-viewer:save-button")).toBeNull()
  })

  it("disables preview for binary bodies without base64 content", () => {
    renderViewer({
      httpData: {
        headers: { "content-type": "image/png" },
        bodyBase64: undefined,
      },
    })

    const bodyPanel = getByDataTestId("response-viewer:body")
    expect(bodyPanel).toHaveTextContent(/Binary body; preview disabled/)
  })
})
