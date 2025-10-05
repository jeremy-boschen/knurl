import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/state", () => ({
  useRequestTab: vi.fn(),
  useCollection: vi.fn(),
  utilitySheetsApi: vi.fn(() => ({ openSheet: vi.fn() })),
}))

import { useRequestTab, useCollection, utilitySheetsApi } from "@/state"
import { EnvironmentSelector } from "./environment-selector"

describe("EnvironmentSelector", () => {
  beforeEach(() => vi.clearAllMocks())

  it("opens Manage Environments sheet with correct context", async () => {
    const user = userEvent.setup()
    vi.mocked(useRequestTab).mockReturnValue({
      state: { activeTab: { collectionId: "col-1" } },
      actions: {},
    } as any)
    vi.mocked(useCollection).mockReturnValue({
      state: {
        collection: {
          id: "col-1",
          name: "C",
          updated: new Date().toISOString(),
          encryption: { algorithm: "aes-gcm" },
          activeEnvironmentId: "e1",
          environments: { e1: { id: "e1", name: "Env", variables: {} } },
        },
      },
      actions: { collectionsApi: () => ({ setActiveEnvironment: vi.fn() }) },
    } as any)
    const openSheet = vi.fn()
    ;(utilitySheetsApi as unknown as vi.Mock).mockReturnValue({ openSheet })

    render(<EnvironmentSelector />)
    const trigger = screen.getAllByRole("button", { name: /env|no environment/i })[0]
    await user.click(trigger)
    const manage = await screen.findByRole("menuitem", { name: /manage environments/i })
    await user.click(manage)
    expect(openSheet).toHaveBeenCalledWith({
      type: "collection-settings",
      context: { collectionId: "col-1", selectedEnvironmentId: "e1", tab: "environments" },
    })
  })

  it("selecting 'No Environment' clears the active environment", async () => {
    const user = userEvent.setup()
    const setActiveEnvironment = vi.fn()
    vi.mocked(useRequestTab).mockReturnValue({
      state: { activeTab: { collectionId: "col-1" } },
      actions: {},
    } as any)
    vi.mocked(useCollection).mockReturnValue({
      state: {
        collection: {
          id: "col-1",
          name: "C",
          updated: new Date().toISOString(),
          encryption: { algorithm: "aes-gcm" },
          activeEnvironmentId: "e1",
          environments: { e1: { id: "e1", name: "Env", variables: {} } },
        },
      },
      actions: { collectionsApi: () => ({ setActiveEnvironment }) },
    } as any)

    render(<EnvironmentSelector />)
    const [trigger] = screen.getAllByRole("button", { name: /env|no environment/i })
    await user.click(trigger)
    const noneItem = await screen.findByRole("menuitem", { name: /no environment/i })
    await user.click(noneItem)
    expect(setActiveEnvironment).toHaveBeenCalledWith("col-1", undefined)
  })
})
