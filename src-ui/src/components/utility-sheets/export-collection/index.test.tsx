import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ExportCollectionSheet from "./index"
import { Sheet, SheetContent } from "@/components/ui/sheet"

const getByDataTestId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Element with data-test-id=${id} not found`)
  }
  return el as HTMLElement
}

vi.mock("@/bindings/knurl", () => ({
  saveFile: vi.fn(),
}))
import { saveFile } from "@/bindings/knurl"

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}))
import { revealItemInDir } from "@tauri-apps/plugin-opener"

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}))
import { writeText } from "@tauri-apps/plugin-clipboard-manager"

vi.mock("@/state", () => ({
  useCollection: vi.fn(),
  useCollections: vi.fn(() => ({ actions: { collectionsApi: () => ({ exportCollection: vi.fn() }) } })),
}))
import { useCollection, useCollections } from "@/state"

const exportedFixture = () => ({
  format: "native" as const,
  version: "1",
  exportedAt: new Date().toISOString(),
  collection: {
    id: "col",
    name: "C",
    updated: new Date().toISOString(),
    encryption: { algorithm: "aes-gcm" },
    environments: [{ id: "e1", name: "Env", variables: {} }],
    requests: [
      { id: "r1", name: "A", method: "GET", url: "/a" },
      { id: "r2", name: "B", method: "POST", url: "/b" },
    ],
    authentication: { type: "none" },
  },
})

describe("ExportCollectionSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exports selected items and shows success status", async () => {
    const user = userEvent.setup()
    const collection = {
      id: "col",
      name: "My Collection",
      updated: new Date().toISOString(),
      encryption: { algorithm: "aes-gcm" },
      environments: { e1: { id: "e1", name: "Env", variables: {} } },
      requests: {
        r1: { id: "r1", name: "A", method: "GET", url: "/a" },
        r2: { id: "r2", name: "B", method: "POST", url: "/b" },
      },
      authentication: { type: "none" },
    }
    vi.mocked(useCollection).mockReturnValue({ state: { collection }, actions: {} } as any)
    const exportCollection = vi.fn(() => exportedFixture())
    vi.mocked(useCollections).mockReturnValue({ actions: { collectionsApi: () => ({ exportCollection }) } } as any)
    vi.mocked(saveFile).mockResolvedValue("/tmp/col_export.json")

    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent side="right">
          <ExportCollectionSheet collectionId="col" />
        </SheetContent>
      </Sheet>,
    )

    // Click Export
    const exportBtns = await screen.findAllByRole("button", { name: /^export$/i })
    await user.click(exportBtns[exportBtns.length - 1])

    expect(exportCollection).toHaveBeenCalledWith("col")
    expect(saveFile).toHaveBeenCalled()
    expect(await screen.findByText(/export successful/i)).toBeInTheDocument()
    expect(await screen.findByText(/col_export.json/i)).toBeInTheDocument()

    const revealBtn = await waitFor(() => getByDataTestId("export-collection:reveal-button"))
    await user.click(revealBtn)
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/col_export.json")

    const copyBtn = await waitFor(() => getByDataTestId("export-collection:copy-path-button"))
    await user.click(copyBtn)
    expect(writeText).toHaveBeenCalledWith("/tmp/col_export.json")
  })

  it("handles user cancellation with an error status", async () => {
    const user = userEvent.setup()
    const collection = {
      id: "col",
      name: "My Collection",
      updated: new Date().toISOString(),
      encryption: { algorithm: "aes-gcm" },
      environments: {},
      requests: { r1: { id: "r1", name: "A", method: "GET", url: "/a" } },
      authentication: { type: "none" },
    }
    vi.mocked(useCollection).mockReturnValue({ state: { collection }, actions: {} } as any)
    const exportCollection = vi.fn(() => exportedFixture())
    vi.mocked(useCollections).mockReturnValue({ actions: { collectionsApi: () => ({ exportCollection }) } } as any)
    const err: any = new Error("[UserCancelled] Cancelled by user")
    err.appError = { kind: "UserCancelled", message: "Cancelled by user", timestamp: new Date().toISOString() }
    vi.mocked(saveFile).mockRejectedValue(err)

    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent side="right">
          <ExportCollectionSheet collectionId="col" />
        </SheetContent>
      </Sheet>,
    )

    const exportBtns = await screen.findAllByRole("button", { name: /^export$/i })
    await user.click(exportBtns[exportBtns.length - 1])

    expect(await screen.findByText(/export failed/i)).toBeInTheDocument()
    expect(await screen.findByText(/cancelled by user/i)).toBeInTheDocument()

    const retryBtn = await waitFor(() => getByDataTestId("export-collection:retry-button"))
    await user.click(retryBtn)
    expect(exportCollection).toHaveBeenCalledTimes(2)

    const dismissBtn = await waitFor(() => getByDataTestId("export-collection:dismiss-status-button"))
    await user.click(dismissBtn)
    expect(screen.queryByText(/export failed/i)).not.toBeInTheDocument()
  })

  it("applies filter and selection to exported payload", async () => {
    const user = userEvent.setup()
    const collection = {
      id: "col",
      name: "Filter Test",
      updated: new Date().toISOString(),
      encryption: { algorithm: "aes-gcm" },
      environments: {
        e1: { id: "e1", name: "Env One", variables: {} },
        e2: { id: "e2", name: "Env Two", variables: {} },
      },
      requests: {
        r1: { id: "r1", name: "Keep Me", method: "GET", url: "/keep" },
        r2: { id: "r2", name: "Drop Me", method: "POST", url: "/drop" },
      },
      authentication: { type: "none" },
    }
    vi.mocked(useCollection).mockReturnValue({ state: { collection }, actions: {} } as any)
    const exportCollection = vi.fn(() => exportedFixture())
    vi.mocked(useCollections).mockReturnValue({ actions: { collectionsApi: () => ({ exportCollection }) } } as any)

    let savedPayload = ""
    vi.mocked(saveFile).mockImplementationOnce(async (payload: string) => {
      savedPayload = payload
      return "/tmp/filter_export.json"
    })

    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent side="right">
          <ExportCollectionSheet collectionId="col" />
        </SheetContent>
      </Sheet>,
    )

    // Clear selections then filter down and pick only r1
    const masterCheckbox = await waitFor(() => getByDataTestId("export-collection:requests-master-checkbox"))
    await user.click(masterCheckbox) // deselect all requests
    const filterInput = await waitFor(() => getByDataTestId("export-collection:filter-input"))
    await user.type(filterInput, "keep")
    const reqCheckbox = await waitFor(() => getByDataTestId("export-collection:request-checkbox:r1"))
    await user.click(reqCheckbox)
    const envCheckboxE2 = await waitFor(() => getByDataTestId("export-collection:environment-checkbox:e2"))
    await user.click(envCheckboxE2)

    // Export
    const exportBtn = await waitFor(() => getByDataTestId("export-collection:export-button"))
    await user.click(exportBtn)

    const parsed = JSON.parse(savedPayload)
    expect(parsed.collection.requests).toHaveLength(1)
    expect(parsed.collection.requests[0].name).toBe("A") // from fixture after filtering
    expect(parsed.collection.environments).toHaveLength(1)
    expect(parsed.collection.environments[0].id).toBe("e1")
  })
})
