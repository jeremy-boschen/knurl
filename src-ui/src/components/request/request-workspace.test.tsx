import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import RequestWorkspace from "./request-workspace"
import { createRequestFixture } from "@test/fixtures/collections"

const hoistedState = vi.hoisted(() => ({
  useRequestTab: vi.fn(),
  useCollection: vi.fn(),
  credentialsCacheApi: vi.fn(() => ({})),
  saveDialogProps: null as null | {
    open: boolean
    onSave: (collectionId: string, name: string) => void
    onClose: () => void
  },
}))

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

const buildExportCommandMock = vi.hoisted(() => vi.fn().mockResolvedValue("curl command"))

let clipboardWriteMock: ReturnType<typeof vi.fn>

vi.mock("@/state", () => ({
  useRequestTab: hoistedState.useRequestTab,
  ScratchCollectionId: "scratch"
}))

vi.mock("@/state/application", () => ({
  useCollection: hoistedState.useCollection,
  credentialsCacheApi: hoistedState.credentialsCacheApi,
}))

vi.mock("@/components/request/save-request-dialog", () => ({
  __esModule: true,
  default: (props: any) => {
    hoistedState.saveDialogProps = props
    return props.open ? <div data-testid="save-request-dialog" /> : null
  },
}))

vi.mock("@/components/request/editor", () => ({
  RequestEditor: ({ tabId }: { tabId: string }) => <div data-testid="request-editor">{tabId}</div>,
}))

vi.mock("@/components/response/response-viewer", () => ({
  __esModule: true,
  default: ({ tabId }: { tabId: string }) => <div data-testid="response-viewer">{tabId}</div>,
}))

vi.mock("@/components/error/error-boundary", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div role="separator" />,
  DropdownMenuItem: ({ children, onSelect, ...props }: any) => (
    <button
      type="button"
      {...props}
      onClick={() => onSelect?.({ preventDefault() {}, stopPropagation() {} })}
    >
      {children}
    </button>
  ),
}))

vi.mock("@jeremy-boschen/react-adjustable-panels", () => {
  const PanelGroup = React.forwardRef<
    HTMLDivElement,
    React.PropsWithChildren<{ direction: string; className?: string }>
  >(({ children, direction, className }, ref) => {
    if (typeof ref === "function") {
      ref({ panelGroup: true } as any)
    } else if (ref) {
      ;(ref as React.MutableRefObject<any>).current = { panelGroup: true }
    }
    return (
      <div data-testid="panel-group" data-direction={direction} className={className}>
        {children}
      </div>
    )
  })

  const Panel = ({ children }: React.PropsWithChildren) => <div data-testid="panel">{children}</div>
  const ResizeHandle = ({ children }: React.PropsWithChildren) => <div data-testid="resize-handle">{children}</div>

  return { PanelGroup, Panel, ResizeHandle }
})

vi.mock("@/components/ui/sonner", () => ({
  toast: toastMocks,
}))

vi.mock("@/lib/request/exporters", () => ({
  buildExportCommand: buildExportCommandMock,
}))

const buildRequestTab = (overrides?: Partial<ReturnType<typeof createRequestFixture>>) => {
  const request = createRequestFixture({
    id: "req-1",
    collectionId: overrides?.collectionId ?? "col-1",
    method: overrides?.method ?? "GET",
    url: overrides?.url ?? "https://api.knurl.dev",
    ...overrides,
  })

  const requestTabsApi = {
    updateTabRequest: vi.fn(),
    clearResponse: vi.fn(),
    sendRequest: vi.fn().mockResolvedValue(undefined),
    cancelRequest: vi.fn(),
    saveTab: vi.fn(),
    saveNewTab: vi.fn(),
    createRequestTab: vi.fn(),
    loadTab: vi.fn().mockResolvedValue(undefined),
    openRequestTab: vi.fn(),
  }

  return {
    state: {
      activeTab: {
        tabId: "tab-1",
        collectionId: request.collectionId,
        response: { data: { status: 200 } },
        sending: false,
        selectedEnvironmentId: null,
      },
      request,
      original: { ...request },
      isDirty: true,
    },
    actions: { requestTabsApi },
  }
}

const renderWorkspace = () => {
  const collection = {
    id: "col-1",
    name: "Workspace",
    activeEnvironmentId: undefined,
    environments: {},
  }
  hoistedState.useCollection.mockReturnValue({ state: { collection } })
  return render(<RequestWorkspace tabId="tab-1" />)
}

const getByDataTestId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Element ${id} not found`)
  }
  return el as HTMLElement
}

describe("RequestWorkspace", () => {
  beforeEach(() => {
    hoistedState.saveDialogProps = null
    hoistedState.useRequestTab.mockReset()
    hoistedState.useCollection.mockReset()
    hoistedState.credentialsCacheApi.mockReturnValue({})
    toastMocks.success.mockReset()
    toastMocks.error.mockReset()
    buildExportCommandMock.mockReset()
    buildExportCommandMock.mockResolvedValue("curl command")
    clipboardWriteMock = vi.fn()
    const fakeNavigator = { clipboard: { writeText: clipboardWriteMock } }
    Object.defineProperty(global, "navigator", {
      value: fakeNavigator,
      configurable: true,
    })
    Object.defineProperty(window, "navigator", {
      value: fakeNavigator,
      configurable: true,
    })
  })

  it("returns null when no request tab exists", () => {
    hoistedState.useRequestTab.mockReturnValue(null)
    const { container } = render(<RequestWorkspace tabId="missing" />)
    expect(container.firstChild).toBeNull()
  })

  it("clears previous response and sends a request when Send is clicked", async () => {
    const tabData = buildRequestTab()
    hoistedState.useRequestTab.mockReturnValue(tabData)
    renderWorkspace()
    const user = userEvent.setup()
    await user.click(getByDataTestId("request-workspace:send-button"))
    expect(tabData.actions.requestTabsApi.clearResponse).toHaveBeenCalledWith("tab-1")
    expect(tabData.actions.requestTabsApi.sendRequest).toHaveBeenCalledWith("tab-1", tabData.state.request)
  })

  it("opens save dialog for scratch requests", async () => {
    const tabData = buildRequestTab({ collectionId: "scratch" })
    hoistedState.useRequestTab.mockReturnValue(tabData)
    renderWorkspace()
    const user = userEvent.setup()
    await user.click(getByDataTestId("request-workspace:save-button"))
    expect(hoistedState.saveDialogProps).not.toBeNull()
    await act(async () => {
      hoistedState.saveDialogProps?.onSave("col-2", "Renamed")
    })
    expect(tabData.actions.requestTabsApi.saveNewTab).toHaveBeenCalledWith("tab-1", "col-2", "Renamed")
  })

  it("shows cancel button when request is sending", () => {
    const tabData = buildRequestTab()
    tabData.state.activeTab.sending = true
    hoistedState.useRequestTab.mockReturnValue(tabData)
    renderWorkspace()
    expect(getByDataTestId("request-workspace:cancel-button")).toBeInTheDocument()
  })

  it("toggles between vertical and horizontal layouts", async () => {
    const user = userEvent.setup()
    const tabData = buildRequestTab()
    hoistedState.useRequestTab.mockReturnValue(tabData)
    renderWorkspace()

    const panelGroup = screen.getByTestId("panel-group")
    expect(panelGroup.getAttribute("data-direction")).toBe("vertical")
    expect(panelGroup.className).toContain("flex-col")

    await user.click(getByDataTestId("request-workspace:layout-toggle-button"))
    await waitFor(() => {
      const updatedGroup = screen.getByTestId("panel-group")
      expect(updatedGroup.getAttribute("data-direction")).toBe("horizontal")
      expect(updatedGroup.className).toContain("flex-row")
    })
  })

  it("copies export commands via the dropdown options", async () => {
    const user = userEvent.setup()
    const tabData = buildRequestTab()
    hoistedState.useRequestTab.mockReturnValue(tabData)
    renderWorkspace()

    await user.click(getByDataTestId("request-workspace:export-menu-button"))
    await user.click(getByDataTestId("request-workspace:export-option-curl"))

    await waitFor(() => {
      expect(buildExportCommandMock).toHaveBeenCalledWith("curl", expect.any(Object))
      expect(toastMocks.success).toHaveBeenCalledWith("Copied CURL command to clipboard")
    })
  })

  it("shows an error toast when clipboard access fails", async () => {
    const user = userEvent.setup()
    const tabData = buildRequestTab()
    hoistedState.useRequestTab.mockReturnValue(tabData)
    renderWorkspace()

    const missingClipboard = { clipboard: undefined }
    Object.defineProperty(global, "navigator", {
      value: missingClipboard,
      configurable: true,
    })
    Object.defineProperty(window, "navigator", {
      value: missingClipboard,
      configurable: true,
    })

    await user.click(getByDataTestId("request-workspace:export-menu-button"))
    await user.click(getByDataTestId("request-workspace:export-option-wget"))

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith("Clipboard API is unavailable in this environment.")
    })
  })
})
