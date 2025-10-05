import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ExportCollectionSheet from "./index"
import { Sheet, SheetContent } from "@/components/ui/sheet"

vi.mock("@/bindings/knurl", () => ({
  saveFile: vi.fn(),
}))
import { saveFile } from "@/bindings/knurl"

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
    const exportCollection = vi.fn(async () => exportedFixture())
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
    const exportCollection = vi.fn(async () => exportedFixture())
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
  })
})
