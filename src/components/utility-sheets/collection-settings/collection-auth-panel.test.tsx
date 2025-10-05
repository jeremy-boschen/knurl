import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CollectionAuthPanel from "./collection-auth-panel"

vi.mock("@/state", () => ({
  useCollection: vi.fn(),
  useApplication: vi.fn((selector?: any) => {
    const base = { collectionsState: { cache: {} } }
    return typeof selector === "function" ? selector(base) : base
  }),
}))

import { useCollection } from "@/state"

describe("CollectionAuthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not offer Inherit as an auth type", async () => {
    const user = userEvent.setup()

    vi.mocked(useCollection).mockReturnValue({
      collection: {
        id: "col-1",
        name: "Test",
        updated: new Date().toISOString(),
        encryption: { algorithm: "aes-gcm" },
        environments: {},
        requests: {},
        authentication: { type: "none" },
      },
      collectionsApi: () => ({ updateCollection: vi.fn() }),
      loaded: true,
    } as any)

    render(<CollectionAuthPanel collectionId="col-1" />)
    const trigger = screen.getByRole("button", { name: "None" })
    await user.click(trigger)

    // The dropdown should not contain an "Inherit" option for collections
    expect(screen.queryByRole("menuitemradio", { name: "Inherit" })).toBeNull()
  })

  it("updates collection auth type when selected", async () => {
    const user = userEvent.setup()
    const updateCollection = vi.fn()

    vi.mocked(useCollection).mockReturnValue({
      collection: {
        id: "col-1",
        name: "Test",
        updated: new Date().toISOString(),
        encryption: { algorithm: "aes-gcm" },
        environments: {},
        requests: {},
        authentication: { type: "none" },
      },
      collectionsApi: () => ({ updateCollection }),
      loaded: true,
    } as any)

    render(<CollectionAuthPanel collectionId="col-1" />)
    const trigger = screen.getByRole("button", { name: "None" })
    await user.click(trigger)
    const basic = await screen.findByRole("menuitemradio", { name: "Basic" })
    await user.click(basic)
    expect(updateCollection).toHaveBeenCalledWith("col-1", { authentication: { type: "basic" } })
  })

  it("allows selecting OAuth2 grant type", async () => {
    const user = userEvent.setup()
    const updateCollection = vi.fn()

    vi.mocked(useCollection).mockReturnValue({
      collection: {
        id: "col-1",
        name: "Test",
        updated: new Date().toISOString(),
        encryption: { algorithm: "aes-gcm" },
        environments: {},
        requests: {},
        authentication: { type: "oauth2", oauth2: { grantType: "client_credentials" } },
      },
      collectionsApi: () => ({ updateCollection }),
      loaded: true,
    } as any)

    render(<CollectionAuthPanel collectionId="col-1" />)

    // Open Grant Type select
    const grantTrigger = screen.getByRole("combobox", { name: /grant type/i })
    await user.click(grantTrigger)

    const refreshItem = await screen.findByRole("option", { name: /refresh token/i })
    await user.click(refreshItem)

    // Expect update called with grantType change
    expect(updateCollection).toHaveBeenCalledWith(
      "col-1",
      expect.objectContaining({
        authentication: expect.objectContaining({ oauth2: expect.objectContaining({ grantType: "refresh_token" }) }),
      }),
    )

    // UI won't re-render grant-dependent fields without store update; assert call only
  })
})
