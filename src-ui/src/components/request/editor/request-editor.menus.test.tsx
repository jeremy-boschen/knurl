import React, { createContext, useContext } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const dropdownContext = createContext<{ onValueChange?: (value: string) => void }>({})

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: () => null,
  DropdownMenuContent: ({ children, ...props }: any) => (
    <div role="menu" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onSelect, ...props }: any) => (
    <button
      type="button"
      {...props}
      onClick={() => onSelect?.({ preventDefault() {}, stopPropagation() {} })}
    >
      {children}
    </button>
  ),
  DropdownMenuRadioGroup: ({ children, onValueChange }: any) => (
    <dropdownContext.Provider value={{ onValueChange }}>{children}</dropdownContext.Provider>
  ),
  DropdownMenuRadioItem: ({ children, value, "data-test-id": dataTestId }: any) => {
    const ctx = useContext(dropdownContext)
    return (
      <button type="button" data-test-id={dataTestId} onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
    )
  },
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children, inset: _inset, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuSubContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/components/ui/knurl/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/tabs", () => {
  const TabsContext = React.createContext<{ value: string; onValueChange?: (value: string) => void }>({
    value: "",
  })

  const Tabs = ({ value, onValueChange, children }: any) => (
    <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>
  )
  const TabsList = ({ children }: any) => <div role="tablist">{children}</div>
  const TabsTrigger = ({ value, children, ...props }: any) => {
    const ctx = React.useContext(TabsContext)
    return (
      <button
        type="button"
        role="tab"
        aria-selected={ctx.value === value}
        onClick={() => ctx.onValueChange?.(value)}
        {...props}
      >
        {children}
      </button>
    )
  }
  const TabsContent = ({ value, children }: any) => {
    const ctx = React.useContext(TabsContext)
    if (ctx.value !== value) {
      return null
    }
    return (
      <div role="tabpanel" aria-label={value}>
        {children}
      </div>
    )
  }

  return { Tabs, TabsList, TabsTrigger, TabsContent }
})

vi.mock("./request-parameters-panel", () => ({
  RequestParametersPanel: ({ tabId }: { tabId: string }) => <div data-test-id={`mock-params-panel:${tabId}`} />,
}))
vi.mock("./request-headers-panel", () => ({
  RequestHeadersPanel: ({ tabId }: { tabId: string }) => <div data-test-id={`mock-headers-panel:${tabId}`} />,
}))
vi.mock("./request-body-panel", () => ({
  RequestBodyPanel: ({ tabId }: { tabId: string }) => <div data-test-id={`mock-body-panel:${tabId}`} />,
}))
vi.mock("./request-auth-panel", () => ({
  RequestAuthPanel: ({ tabId }: { tabId: string }) => <div data-test-id={`mock-auth-panel:${tabId}`} />,
}))
vi.mock("./request-options-panel", () => ({
  RequestOptionsPanel: ({ tabId }: { tabId: string }) => <div data-test-id={`mock-options-panel:${tabId}`} />,
}))

const useRequestBodyMock = vi.fn()
const useRequestTabMock = vi.fn()
const useCollectionsMock = vi.fn()
const useRequestParametersMock = vi.fn()
const useRequestHeadersMock = vi.fn()

vi.mock("@/state", () => ({
  useRequestBody: (tabId: string) => useRequestBodyMock(tabId),
  useRequestTab: (tabId: string) => useRequestTabMock(tabId),
  useCollections: () => useCollectionsMock(),
  useRequestParameters: (tabId: string) => useRequestParametersMock(tabId),
  useRequestHeaders: (tabId: string) => useRequestHeadersMock(tabId),
}))

const bodyActions = {
  updateBody: vi.fn(),
  addFormItem: vi.fn(),
  updateFormItem: vi.fn(),
}

const collectionsApiMock = {
  setRequestAuthentication: vi.fn(),
  discardRequestPatch: vi.fn(),
}

const requestTabsApiMock = {
  updateTab: vi.fn(),
}

const paramsActions = {
  addPathParam: vi.fn(),
  addQueryParam: vi.fn(),
  addCookieParam: vi.fn(),
}

const headersActions = {
  addHeader: vi.fn(),
}

let BodyTabMenu: typeof import("./request-editor").BodyTabMenu
let AuthTabMenu: typeof import("./request-editor").AuthTabMenu
let RequestEditorComponent: typeof import("./request-editor").RequestEditor

beforeAll(async () => {
  const module = await import("./request-editor")
  BodyTabMenu = module.BodyTabMenu
  AuthTabMenu = module.AuthTabMenu
  RequestEditorComponent = module.RequestEditor
})

beforeEach(() => {
  vi.clearAllMocks()
  requestTabsApiMock.updateTab.mockClear()
  useRequestBodyMock.mockReturnValue({
    state: { body: { type: "text", language: "rust" } },
    actions: bodyActions,
  })
  useRequestTabMock.mockReturnValue({
    state: {
      request: { collectionId: "col-1", id: "req-1", authentication: { type: "none" } },
      activeTab: { tabId: "tab-1", requestId: "req-1", collectionId: "col-1", activeTab: "body" },
      isDirty: false,
    },
    actions: { requestTabsApi: requestTabsApiMock },
  })
  useCollectionsMock.mockReturnValue({
    actions: { collectionsApi: () => collectionsApiMock },
  })
  useRequestParametersMock.mockReturnValue({
    state: { cookieParams: undefined },
    actions: paramsActions,
  })
  useRequestHeadersMock.mockReturnValue({
    actions: headersActions,
  })
})

describe("request-editor menus", () => {
  it("switches body types and adds file fields", async () => {
    const user = userEvent.setup()
    render(<BodyTabMenu tabId="tab-1" onActivate={() => {}} />)

    await user.click(getByDataId("request-editor:body-menu:type-binary"))
    expect(bodyActions.updateBody).toHaveBeenCalledWith({ type: "binary" })

    useRequestBodyMock.mockReturnValue({
      state: { body: { type: "form", encoding: "url" } },
      actions: bodyActions,
    })
    render(<BodyTabMenu tabId="tab-1" onActivate={() => {}} />)
    await user.click(getByDataId("request-editor:body-menu:add-file-field"))
    expect(bodyActions.updateBody).toHaveBeenCalledWith(expect.objectContaining({ encoding: "multipart" }))
    expect(bodyActions.updateFormItem).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ kind: "file" }))
  })

  it("changes authentication type", async () => {
    const user = userEvent.setup()
    render(<AuthTabMenu tabId="tab-1" onActivate={() => {}} />)

    await user.click(getByDataId("request-editor:auth-menu:type-bearer"))
    expect(collectionsApiMock.setRequestAuthentication).toHaveBeenCalledWith(
      "col-1",
      "req-1",
      expect.objectContaining({ type: "bearer" }),
    )
  })

  it("reveals extra text languages and switches to CSS", async () => {
    const user = userEvent.setup()
    useRequestBodyMock.mockReturnValue({
      state: { body: { type: "text", language: "json" } },
      actions: bodyActions,
    })

    render(<BodyTabMenu tabId="tab-1" onActivate={() => {}} />)

    await user.click(getByDataId("request-editor:body-menu:type-text-css"))
    expect(bodyActions.updateBody).toHaveBeenCalledWith({ type: "text", language: "css", content: "" })
  })

  it("adds plain text form fields", async () => {
    const user = userEvent.setup()
    useRequestBodyMock.mockReturnValue({
      state: { body: { type: "form", encoding: "url" } },
      actions: bodyActions,
    })

    render(<BodyTabMenu tabId="tab-1" onActivate={() => {}} />)
    await user.click(getByDataId("request-editor:body-menu:add-text-field"))
    expect(bodyActions.addFormItem).toHaveBeenCalled()
  })


  describe("RequestEditor", () => {
    it("shows dirty indicator and discards changes", async () => {
      const user = userEvent.setup()
      useRequestTabMock.mockReturnValue({
        state: {
          request: { collectionId: "col-1", id: "req-1", authentication: { type: "none" } },
          activeTab: { tabId: "tab-1", collectionId: "col-1", requestId: "req-1", activeTab: "body" },
          isDirty: true,
        },
        actions: { requestTabsApi: requestTabsApiMock },
      })

      render(<RequestEditorComponent tabId="tab-1" />)

      expect(getByDataId("request-editor:dirty-indicator")).toBeInTheDocument()
      await user.click(getByDataId("request-editor:discard-changes-button"))
      expect(collectionsApiMock.discardRequestPatch).toHaveBeenCalledWith("col-1", "req-1")
    })

    it("updates active tab when triggers clicked", async () => {
      const user = userEvent.setup()
      render(<RequestEditorComponent tabId="tab-1" />)

      await user.click(getByDataId("request-editor:headers-tab"))
      expect(requestTabsApiMock.updateTab).toHaveBeenCalledWith("tab-1", expect.objectContaining({ activeTab: "headers" }))
    })
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Element ${id} not found`)
  }
  return el as HTMLElement
}
