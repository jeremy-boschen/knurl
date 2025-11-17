import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CollectionAuthPanel from "./collection-auth-panel"

const updateCollectionMock = vi.fn()

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
  useApplication: vi.fn((selector?: (state: any) => any) =>
    selector ? selector({ requestTabsState: { openTabs: {} }, credentialsCacheState: { cache: {} } }) : {},
  ),
  credentialsCacheApi: () => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }),
}))

vi.mock("@/bindings/knurl", () => ({
  discoverOidc: vi.fn(),
  getAuthenticationResult: vi.fn(),
}))

describe("CollectionAuthPanel", () => {
  beforeEach(() => {
    updateCollectionMock.mockClear()
    stateMocks.collection = {
      id: "col-1",
      authentication: { type: "basic", basic: { username: "alice", password: "secret" } },
    }
  })

  it("updates basic auth credentials", () => {
    render(<CollectionAuthPanel collectionId="col-1" />)

    const usernameInput = getByDataId("collection-auth:basic-username-input") as HTMLInputElement
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
      authentication: { type: "bearer" },
    })
  })

  it("updates bearer placement details", async () => {
    const user = userEvent.setup()
    stateMocks.collection = {
      id: "col-1",
      authentication: { type: "bearer", bearer: { token: "abc", placement: { type: "header", name: "Authorization" } } },
    }

    render(<CollectionAuthPanel collectionId="col-1" />)

    await user.click(getByDataId("collection-auth:bearer-placement-trigger"))
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

    await user.click(getByDataId("collection-auth:api-key-placement-trigger"))
    await user.click(await screen.findByText(/Query Param/i))

    expect(updateCollectionMock).toHaveBeenCalledWith("col-1", {
      authentication: {
        type: "apiKey",
        apiKey: expect.objectContaining({ placement: expect.objectContaining({ type: "query" }) }),
      },
    })

    const nameInput = getByDataId("collection-auth:api-key-name-input") as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "X-Custom" } })
    expect(updateCollectionMock).toHaveBeenCalledWith("col-1", {
      authentication: {
        type: "apiKey",
        apiKey: expect.objectContaining({ placement: expect.objectContaining({ name: "X-Custom" }) }),
      },
    })
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}
