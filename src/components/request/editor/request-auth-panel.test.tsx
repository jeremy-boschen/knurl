import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import * as applicationState from "@/state/application"
vi.mock("@/bindings/knurl", () => ({
  discoverOidc: vi.fn(async () => ({
    authorizationEndpoint: "https://issuer/authorize",
    tokenEndpoint: "https://issuer/token",
  })),
}))
const { discoverOidc } = await import("@/bindings/knurl")
import { RequestAuthPanel } from "./request-auth-panel"
import { useCollections, useRequestTab } from "@/state"

// Mock the state hooks
vi.mock("@/state/application", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/state/application")>()
  return {
    ...actual,
    useApplication: vi.fn(),
  }
})

vi.mock("@/state", () => ({
  useRequestTab: vi.fn(),
  useCollections: vi.fn(),
}))

const mockUpdateRequestPatch = vi.fn()
const mockRemoveToken = vi.fn()
const mockRunAuthOnly = vi.fn()

const credentialsApiSpy = vi.spyOn(applicationState, "credentialsCacheApi")

const mockRequest = {
  id: "req-1",
  collectionId: "col-1",
  authentication: {
    type: "none",
  },
}

let currentRequestState: any = null
let currentOriginalState: any = null
let currentActiveTabState: { collectionId: string; requestId: string; tabId: string } | null = null

const setRequestTabState = (
  overrides: Partial<(typeof mockRequest) & { body?: any }> = {},
  originalOverrides: any = {},
) => {
  currentRequestState = { ...mockRequest, method: "GET", url: "https://api", ...overrides }
  currentOriginalState = { ...mockRequest, method: "GET", url: "https://api", ...originalOverrides }
  currentActiveTabState = { collectionId: "col-1", requestId: "req-1", tabId: "tab-1" }

  vi.mocked(useRequestTab).mockReturnValue({
    state: {
      request: currentRequestState,
      activeTab: currentActiveTabState,
      original: currentOriginalState,
      isDirty: false,
    },
    actions: {
      requestTabsApi: {
        runAuthOnly: mockRunAuthOnly,
      },
    },
  } as any)
}

describe("RequestAuthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    credentialsApiSpy.mockReturnValue({
      remove: mockRemoveToken,
      get: vi.fn().mockResolvedValue({
        headers: { Authorization: "Bearer cached" },
        expiresAt: Date.now() / 1000 + 3600,
      }),
    } as any)

    // Provide mock implementations for the hooks
    setRequestTabState()

    vi.mocked(useCollections).mockReturnValue({
      state: { collectionsIndex: [] },
      actions: { collectionsApi: () => ({ updateRequestPatch: mockUpdateRequestPatch }) },
    } as any)

    vi.mocked(applicationState.useApplication).mockImplementation((selector?: any) => {
      const base: any = {
        requestTabsState: {
          activeTab: currentActiveTabState?.tabId ?? null,
          openTabs: currentActiveTabState
            ? {
                [currentActiveTabState.tabId]: {
                  merged: currentRequestState,
                  collectionId: currentActiveTabState.collectionId,
                  requestId: currentActiveTabState.requestId,
                },
              }
            : {},
        },
        collectionsState: { cache: {} },
        credentialsCacheState: { cache: {} },
      }
      return typeof selector === "function" ? selector(base) : base
    })
  })

  it("renders the auth type label", () => {
    render(<RequestAuthPanel tabId="tab-1" />)
    expect(screen.getByText("None", { selector: "span" })).toBeInTheDocument()
  })

  it("renders basic auth fields when auth type is basic", () => {
    setRequestTabState({ authentication: { type: "basic", basic: {} } })

    render(<RequestAuthPanel tabId="tab-1" />)

    expect(screen.getByLabelText("Username")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
  })

  it("updates the request patch when basic auth fields are changed", () => {
    setRequestTabState({ authentication: { type: "basic", basic: {} } })

    render(<RequestAuthPanel tabId="tab-1" />)

    const usernameInput = screen.getByLabelText("Username")
    fireEvent.change(usernameInput, { target: { value: "testuser" } })

    expect(mockUpdateRequestPatch).toHaveBeenCalledWith("col-1", "req-1", {
      authentication: { type: "basic", basic: { username: "testuser" } },
    })

    const passwordInput = screen.getByLabelText("Password")
    fireEvent.change(passwordInput, { target: { value: "testpass" } })

    expect(mockUpdateRequestPatch).toHaveBeenCalledWith("col-1", "req-1", {
      authentication: { type: "basic", basic: { password: "testpass" } },
    })
  })

  it("renders api key fields when auth type is apiKey", () => {
    setRequestTabState({ authentication: { type: "apiKey", apiKey: {} } })

    render(<RequestAuthPanel tabId="tab-1" />)

    expect(screen.getByLabelText("Key")).toBeInTheDocument()
    expect(screen.getByLabelText("Value")).toBeInTheDocument()
  })

  it("bearer custom scheme shows input and updates", async () => {
    const user = userEvent.setup()
    setRequestTabState(
      {
        body: { type: "form", encoding: "url" },
        authentication: { type: "bearer", bearer: { token: "t", scheme: "custom", placement: { type: "header" } } },
      },
      {
        body: { type: "form", encoding: "url" },
        authentication: { type: "bearer", bearer: { token: "t", scheme: "custom", placement: { type: "header" } } },
      },
    )

    render(<RequestAuthPanel tabId="tab-1" />)
    // Change scheme to custom -> input appears labeled "Custom Scheme"
    const schemeTrigger = screen.getByRole("combobox", { name: /scheme/i })
    await user.click(schemeTrigger)
    const customItem = await screen.findByRole("option", { name: /custom/i })
    await user.click(customItem)

    const customInput = await screen.findByLabelText(/custom scheme/i)
    fireEvent.change(customInput, { target: { value: "Token" } })
    expect(mockUpdateRequestPatch).toHaveBeenCalledWith(
      "col-1",
      "req-1",
      expect.objectContaining({ authentication: expect.objectContaining({ bearer: expect.objectContaining({ scheme: "Token" }) }) }),
    )
  })

  it("bearer placement changes update patch (header→query)", async () => {
    const user = userEvent.setup()
    setRequestTabState(
      {
        body: { type: "text", language: "json" },
        authentication: { type: "bearer", bearer: { token: "t", scheme: "Bearer", placement: { type: "header" } } },
      },
      {
        body: { type: "text", language: "json" },
        authentication: { type: "bearer", bearer: { token: "t", scheme: "Bearer", placement: { type: "header" } } },
      },
    )

    render(<RequestAuthPanel tabId="tab-1" />)
    const placementTrigger = screen.getByRole("combobox", { name: /placement/i })
    await user.click(placementTrigger)
    const qItem = await screen.findByRole("option", { name: /query param/i })
    await user.click(qItem)
    expect(mockUpdateRequestPatch).toHaveBeenCalledWith(
      "col-1",
      "req-1",
      expect.objectContaining({
        authentication: expect.objectContaining({
          bearer: expect.objectContaining({ placement: expect.objectContaining({ type: "query" }) }),
        }),
      }),
    )
  })

  it("clears the credentials cache when the delete token button is clicked (oauth2)", async () => {
    const user = userEvent.setup()
    setRequestTabState({ authentication: { type: "oauth2", oauth2: {} } })

    render(<RequestAuthPanel tabId="tab-1" />)

    const deleteBtn = screen.getByRole("button", { name: /delete/i })
    await user.click(deleteBtn)

    expect(mockRemoveToken).toHaveBeenCalled()
  })

  it("uses discoveryUrl issuer base and appends .well-known for discovery", async () => {
    const user = userEvent.setup()
    setRequestTabState({ authentication: { type: "oauth2", oauth2: { discoveryUrl: "https://issuer.example.com" } } })

    render(<RequestAuthPanel tabId="tab-1" />)
    const discoverBtn = screen.getByRole("button", { name: /discover/i })
    await user.click(discoverBtn)

    expect(discoverOidc).toHaveBeenCalledWith("https://issuer.example.com/.well-known/openid-configuration")
    expect(mockUpdateRequestPatch).toHaveBeenCalledWith(
      "col-1",
      "req-1",
      expect.objectContaining({
        authentication: expect.objectContaining({
          oauth2: expect.objectContaining({ authUrl: expect.any(String), tokenUrl: expect.any(String) }),
        }),
      }),
    )
  })

  it("uses full .well-known discovery URL as-is", async () => {
    const user = userEvent.setup()
    setRequestTabState({
      authentication: {
        type: "oauth2",
        oauth2: { discoveryUrl: "https://issuer.example.com/.well-known/openid-configuration" },
      },
    })

    render(<RequestAuthPanel tabId="tab-1" />)
    const discoverBtn = screen.getByRole("button", { name: /discover/i })
    await user.click(discoverBtn)
    expect(discoverOidc).toHaveBeenCalledWith("https://issuer.example.com/.well-known/openid-configuration")
  })

  it("logs an error when OIDC discovery fails", async () => {
    const user = userEvent.setup()
    const error = new Error(
      "[JsonError] Failed to parse OIDC discovery response: expected value at line 1 column 1",
    ) as Error & { appError?: unknown }
    error.appError = {
      kind: "JsonError",
      message: "Failed to parse OIDC discovery response: expected value at line 1 column 1",
      timestamp: new Date().toISOString(),
    }
    vi.mocked(discoverOidc).mockRejectedValueOnce(error)

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    setRequestTabState({ authentication: { type: "oauth2", oauth2: { discoveryUrl: "https://issuer.invalid" } } })

    render(<RequestAuthPanel tabId="tab-1" />)
    const discoverButton = screen.getByRole("button", { name: /discover/i })
    await user.click(discoverButton)

    expect(discoverOidc).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("shows a warning when inheriting body placement but request body is incompatible", () => {
    setRequestTabState(
      {
        authentication: { type: "inherit" },
        body: { type: "text", language: "json" },
      },
      {
        authentication: { type: "inherit" },
        body: { type: "text", language: "json" },
      },
    )

    vi.mocked(applicationState.useApplication).mockImplementation((selector?: any) => {
      const base: any = {
        collectionsState: {
          cache: {
            "col-1": {
              authentication: {
                type: "bearer",
                bearer: {
                  placement: { type: "body", fieldName: "token", contentType: "application/x-www-form-urlencoded" },
                },
              },
            },
          },
        },
        credentialsCacheApi: { remove: mockRemoveToken, get: vi.fn().mockResolvedValue(null) },
      }
      return typeof selector === "function" ? selector(base) : base
    })

    render(<RequestAuthPanel tabId="tab-1" />)

    expect(
      screen.getByText(/inherits authentication that uses Body placement, but the current body is not a Form/i),
    ).toBeInTheDocument()
  })
})
