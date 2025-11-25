import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CollectionAuthPanel from "./collection-auth-panel"

const updateCollectionMock = vi.fn()
const credentialsCacheMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}))

const stateMocks = vi.hoisted(() => ({
  collection: {
    id: "col-1",
    authentication: { type: "basic", basic: { username: "alice", password: "secret" } },
  },
}))

vi.mock("@/state", () => ({
  useCollection: vi.fn(() => ({
    state: stateMocks,
    actions: { collectionsApi: () => ({ updateCollection: updateCollectionMock }) },
  })),
  useCredentialsCacheEntry: vi.fn(() => ({
    state: { cacheEntry: undefined },
    actions: { credentialsCacheApi: () => credentialsCacheMock },
  })),
  useApplication: vi.fn((selector?: (state: any) => any) =>
    selector ? selector({ requestTabsState: { openTabs: {} }, credentialsCacheState: { cache: {} } }) : {},
  ),
  credentialsCacheApi: () => credentialsCacheMock,
}))

const bindingMocks = vi.hoisted(() => ({
  discoverOidc: vi.fn(),
  getAuthenticationResult: vi.fn(),
}))

vi.mock("@/bindings/knurl", () => bindingMocks)

vi.mock("@/components/auth/oauth2-editor", () => ({
  OAuth2Editor: ({ token, onDiscover }: any) => (
    <div>
      <button data-testid="oauth2-discover" onClick={onDiscover}>
        Discover
      </button>
      <button data-testid="oauth2-fetch-token" onClick={() => token.onFetch()}>
        Fetch Token
      </button>
      <button data-testid="oauth2-delete-token" onClick={() => token.onDelete()}>
        Delete Token
      </button>
      <span data-testid="oauth2-token-value">{token.value}</span>
      <span data-testid="oauth2-token-type">{token.type}</span>
    </div>
  ),
}))

describe("CollectionAuthPanel", () => {
  beforeEach(() => {
    updateCollectionMock.mockClear()
    credentialsCacheMock.get.mockReset().mockResolvedValue(undefined)
    credentialsCacheMock.set.mockReset()
    credentialsCacheMock.remove.mockReset()
    bindingMocks.discoverOidc.mockReset()
    bindingMocks.getAuthenticationResult.mockReset()
    stateMocks.collection = {
      id: "col-1",
      authentication: { type: "basic", basic: { username: "alice", password: "secret" } },
    }
  })

  it("updates basic auth credentials", () => {
    render(<CollectionAuthPanel collectionId="col-1" />)

    const usernameInput = getByDataId("collection-auth:basic-auth-username-input") as HTMLInputElement
    fireEvent.change(usernameInput, { target: { value: "bob" } })

    expect(updateCollectionMock).toHaveBeenCalledWith("col-1", {
      authentication: {
        type: "basic",
        basic: expect.objectContaining({ username: "bob" }),
      },
    })
  })

  it("changes auth type via dropdown", async () => {
    const user = userEvent.setup()
    stateMocks.collection = { id: "col-1", authentication: { type: "none" } }
    render(<CollectionAuthPanel collectionId="col-1" />)

    await user.click(getByDataId("collection-auth:type-trigger"))
    await user.click(await screen.findByText(/Bearer/i))

    expect(updateCollectionMock).toHaveBeenCalledWith("col-1", {
      authentication: expect.objectContaining({
        type: "bearer",
        bearer: expect.objectContaining({
          scheme: "Bearer",
          placement: expect.objectContaining({ type: "header", name: "Authorization" }),
        }),
      }),
    })
  })

  it("updates bearer placement details", async () => {
    const user = userEvent.setup()
    stateMocks.collection = {
      id: "col-1",
      authentication: { type: "bearer", bearer: { token: "abc", placement: { type: "header", name: "Authorization" } } },
    }

    render(<CollectionAuthPanel collectionId="col-1" />)

    await user.click(getByDataId("collection-auth:bearer-auth-placement-select"))
    await user.click(await screen.findByText(/Query Param/i))

    expect(updateCollectionMock).toHaveBeenCalledWith("col-1", {
      authentication: {
        type: "bearer",
        bearer: expect.objectContaining({ placement: expect.objectContaining({ type: "query" }) }),
      },
    })
  })

  it("updates api key placement fields", async () => {
    const user = userEvent.setup()
    stateMocks.collection = {
      id: "col-1",
      authentication: {
        type: "apiKey",
        apiKey: { key: "X-Token", value: "secret", placement: { type: "header", name: "X-Token" } },
      },
    }

    render(<CollectionAuthPanel collectionId="col-1" />)

    await user.click(getByDataId("collection-auth:api-key-auth-placement-select"))
    await user.click(await screen.findByText(/Query Param/i))

    expect(updateCollectionMock).toHaveBeenCalledWith("col-1", {
      authentication: {
        type: "apiKey",
        apiKey: expect.objectContaining({ placement: expect.objectContaining({ type: "query" }) }),
      },
    })

    const nameInput = getByDataId("collection-auth:api-key-auth-placement-name-input") as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "X-Custom" } })
    expect(updateCollectionMock).toHaveBeenCalledWith("col-1", {
      authentication: {
        type: "apiKey",
        apiKey: expect.objectContaining({ placement: expect.objectContaining({ name: "X-Custom" }) }),
      },
    })
  })

  it("runs OAuth discovery and updates endpoints", async () => {
    const user = userEvent.setup()
    bindingMocks.discoverOidc.mockResolvedValue({
      authorizationEndpoint: "https://idp.example.com/oauth/auth",
      tokenEndpoint: "https://idp.example.com/oauth/token",
      deviceAuthorizationEndpoint: "https://idp.example.com/oauth/device",
    })
    stateMocks.collection = {
      id: "col-1",
      authentication: { type: "oauth2", oauth2: { discoveryUrl: "https://idp.example.com" } },
    }

    render(<CollectionAuthPanel collectionId="col-1" />)

    await user.click(screen.getByTestId("oauth2-discover"))

    await waitFor(() => expect(bindingMocks.discoverOidc).toHaveBeenCalledWith(
      "https://idp.example.com/.well-known/openid-configuration",
    ))

    expect(updateCollectionMock).toHaveBeenCalledWith(
      "col-1",
      expect.objectContaining({
        authentication: expect.objectContaining({
          oauth2: expect.objectContaining({
            authUrl: "https://idp.example.com/oauth/auth",
            tokenUrl: "https://idp.example.com/oauth/token",
            deviceAuthorizationUrl: "https://idp.example.com/oauth/device",
          }),
        }),
      }),
    )
  })

  it("hydrates cached OAuth tokens and wires credential cache actions", async () => {
    const user = userEvent.setup()
    credentialsCacheMock.get.mockResolvedValueOnce({
      headers: { Authorization: "Bearer cached-token" },
      expiresAt: 12345,
    })
    bindingMocks.getAuthenticationResult.mockResolvedValueOnce({
      headers: { Authorization: "Bearer fresh-token" },
      expiresAt: 67890,
    })
    stateMocks.collection = { id: "col-1", authentication: { type: "oauth2", oauth2: { tokenUrl: "https://token" } } }

    render(<CollectionAuthPanel collectionId="col-1" />)

    const tokenValue = await screen.findByTestId("oauth2-token-value")
    expect(tokenValue).toHaveTextContent("cached-token")
    expect(screen.getByTestId("oauth2-token-type")).toHaveTextContent("Bearer")

    await user.click(screen.getByTestId("oauth2-fetch-token"))
    await waitFor(() => expect(bindingMocks.getAuthenticationResult).toHaveBeenCalled())
    expect(credentialsCacheMock.set).toHaveBeenCalledWith("collection-auth-col-1", {
      headers: { Authorization: "Bearer fresh-token" },
      expiresAt: 67890,
    })

    await user.click(screen.getByTestId("oauth2-delete-token"))
    expect(credentialsCacheMock.remove).toHaveBeenCalledWith("collection-auth-col-1")
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}
