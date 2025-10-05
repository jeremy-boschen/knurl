import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>()
  return {
    ...actual,
    generateUniqueId: () => "mock-field",
  }
})

vi.mock("@/components/request/editor/request-parameters-panel", () => ({
  RequestParametersPanel: () => <div data-testid="params-panel" />,
}))
vi.mock("@/components/request/editor/request-headers-panel", () => ({
  RequestHeadersPanel: () => <div data-testid="headers-panel" />,
}))
vi.mock("@/components/request/editor/request-body-panel", () => ({
  RequestBodyPanel: () => <div data-testid="body-panel" />,
}))
vi.mock("@/components/request/editor/request-auth-panel", () => ({
  RequestAuthPanel: () => <div data-testid="auth-panel" />,
}))
vi.mock("@/components/request/editor/request-options-panel", () => ({
  RequestOptionsPanel: () => <div data-testid="options-panel" />,
}))

vi.mock("@/components/ui/knurl/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const stateMocks = vi.hoisted(() => ({
  useRequestTab: vi.fn(),
  useCollections: vi.fn(),
  useRequestParameters: vi.fn(),
  useRequestHeaders: vi.fn(),
  useRequestBody: vi.fn(),
}))

const updateTabMock = vi.fn()
const discardRequestPatchMock = vi.fn()
const updateRequestPatchMock = vi.fn()

const addPathParamMock = vi.fn()
const addQueryParamMock = vi.fn()
const addCookieParamMock = vi.fn()
const addHeaderMock = vi.fn()
const bodyUpdatePatchMock = vi.fn()
const bodyAddFormItemMock = vi.fn()

vi.mock("@/state", () => stateMocks)

const { useRequestTab, useCollections, useRequestParameters, useRequestHeaders, useRequestBody } = stateMocks

import { RequestEditor } from "./request-editor"

describe("RequestEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useRequestTab.mockImplementation(() => ({
      state: {
        activeTab: {
          tabId: "tab-1",
          activeTab: "params",
          collectionId: "col-1",
          requestId: "req-1",
        },
        request: {
          id: "req-1",
          collectionId: "col-1",
          authentication: { type: "none" },
          method: "GET",
          url: "https://example.com",
        },
        original: {
          id: "req-1",
          collectionId: "col-1",
          authentication: { type: "none" },
          body: { type: "none" },
          method: "GET",
          url: "https://example.com",
        } as any,
        isDirty: false,
      },
      actions: {
        requestTabsApi: {
          updateTab: updateTabMock,
          updateTabRequest: vi.fn(),
          clearResponse: vi.fn(),
          sendRequest: vi.fn(),
          saveTab: vi.fn(),
          saveNewTab: vi.fn(),
          cancelRequest: vi.fn(),
        },
      },
    }))

    useCollections.mockReturnValue({
      state: { collectionsIndex: [] },
      actions: {
        collectionsApi: () => ({
          updateRequestPatch: updateRequestPatchMock,
          discardRequestPatch: discardRequestPatchMock,
        }),
      },
    })

    useRequestParameters.mockReturnValue({
      state: {
        cookieParams: {},
        pathParams: {},
        queryParams: {},
        original: {},
      },
      actions: {
        addPathParam: addPathParamMock,
        addQueryParam: addQueryParamMock,
        addCookieParam: addCookieParamMock,
        updatePathParam: vi.fn(),
        updateQueryParam: vi.fn(),
        updateCookieParam: vi.fn(),
        removePathParam: vi.fn(),
        removeQueryParam: vi.fn(),
        removeCookieParam: vi.fn(),
      },
    })

    useRequestHeaders.mockReturnValue({
      state: {
        headers: {},
        original: {},
      },
      actions: {
        addHeader: addHeaderMock,
        updateHeader: vi.fn(),
        removeHeader: vi.fn(),
      },
    })

    useRequestBody.mockReturnValue({
      state: {
        body: { type: "none" },
        original: { type: "none" },
      },
      actions: {
        updateRequestPatch: bodyUpdatePatchMock,
        addFormItem: bodyAddFormItemMock,
        updateBodyContent: vi.fn(),
        updateFormItem: vi.fn(),
        removeFormItem: vi.fn(),
        formatContent: vi.fn(),
      },
    })
  })

  const renderEditor = () => render(<RequestEditor tabId="tab-1" />)

  it("fires parameter actions from the Params tab dropdown", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByLabelText(/open parameters menu/i))
    expect(updateTabMock).toHaveBeenLastCalledWith("tab-1", { activeTab: "params" })
    await user.click(await screen.findByRole("menuitem", { name: /add path parameter/i }))
    expect(addPathParamMock).toHaveBeenCalled()

    await user.click(screen.getByLabelText(/open parameters menu/i))
    expect(updateTabMock).toHaveBeenLastCalledWith("tab-1", { activeTab: "params" })
    await user.click(await screen.findByRole("menuitem", { name: /add query parameter/i }))
    expect(addQueryParamMock).toHaveBeenCalled()

    await user.click(screen.getByLabelText(/open parameters menu/i))
    expect(updateTabMock).toHaveBeenLastCalledWith("tab-1", { activeTab: "params" })
    await user.click(await screen.findByRole("menuitem", { name: /add cookie/i }))
    expect(addCookieParamMock).toHaveBeenCalled()
  })

  it("adds headers via the Headers tab dropdown", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByLabelText(/open headers menu/i))
    expect(updateTabMock).toHaveBeenLastCalledWith("tab-1", { activeTab: "headers" })
    await user.click(await screen.findByRole("menuitem", { name: /add header/i }))
    expect(addHeaderMock).toHaveBeenCalled()
  })

  it("updates body type and adds form fields through the Body tab dropdown", async () => {
    const user = userEvent.setup()
    const { rerender } = renderEditor()

    await user.click(screen.getByLabelText(/open body menu/i))
    expect(updateTabMock).toHaveBeenLastCalledWith("tab-1", { activeTab: "body" })
    await user.click(await screen.findByRole("menuitemradio", { name: /json/i }))
    expect(bodyUpdatePatchMock).toHaveBeenCalledWith({ body: { type: "text", language: "json", content: "" } })

    useRequestBody.mockReturnValueOnce({
      state: {
        body: { type: "form", encoding: "url", formData: {} },
        original: { type: "form", encoding: "url", formData: {} },
      },
      actions: {
        updateRequestPatch: bodyUpdatePatchMock,
        addFormItem: bodyAddFormItemMock,
        updateBodyContent: vi.fn(),
        updateFormItem: vi.fn(),
        removeFormItem: vi.fn(),
        formatContent: vi.fn(),
      },
    })

    rerender(<RequestEditor tabId="tab-1" />)

    await user.click(screen.getByLabelText(/open body menu/i))
    expect(updateTabMock).toHaveBeenLastCalledWith("tab-1", { activeTab: "body" })
    await user.click(await screen.findByRole("menuitem", { name: /add file field/i }))
    expect(bodyUpdatePatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          encoding: "multipart",
          formData: expect.objectContaining({ "mock-field": expect.objectContaining({ kind: "file" }) }),
        }),
      }),
    )
    expect(bodyUpdatePatchMock).toHaveBeenCalledTimes(2)
  })

  it("updates authentication via the Auth tab dropdown", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByLabelText(/open authentication menu/i))
    expect(updateTabMock).toHaveBeenLastCalledWith("tab-1", { activeTab: "auth" })
    await user.click(await screen.findByRole("menuitemradio", { name: /basic/i }))

    expect(updateRequestPatchMock).toHaveBeenCalledWith("col-1", "req-1", { authentication: { type: "basic" } })
  })
})
