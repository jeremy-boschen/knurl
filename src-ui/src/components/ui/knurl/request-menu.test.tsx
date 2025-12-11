import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const stateRefs = vi.hoisted(() => ({
  useCollection: vi.fn(),
  collectionsApi: vi.fn(),
}))

vi.mock("@/components/ui/dropdown-menu", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/dropdown-menu")>("@/components/ui/dropdown-menu")
  return {
    ...actual,
    DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSubTrigger: ({ children, ...props }: React.ComponentProps<"button">) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

vi.mock("@/state", () => ({
  useCollection: stateRefs.useCollection,
  collectionsApi: stateRefs.collectionsApi,
}))

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RootCollectionFolderId } from "@/types"
import type { RequestMenuMoveTarget } from "./request-menu"
import { RequestMenuContent } from "./request-menu"

const renderMenu = (props: Partial<Parameters<typeof RequestMenuContent>[0]> = {}, onAction = vi.fn()) => {
  const moveTargets: RequestMenuMoveTarget[] = props.moveTargets ?? [
    { id: "folder-a", path: "Root / Folder A" },
  ]

  render(
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <button type="button">Open</button>
      </DropdownMenuTrigger>
      <RequestMenuContent
        collectionId="col-1"
        requestId="req-1"
        requestName="Fetch"
        isScratch={false}
        moveTargets={moveTargets}
        onAction={onAction}
        {...props}
      />
    </DropdownMenu>
  )

  return onAction
}

describe("RequestMenuContent", () => {
  beforeEach(() => {
    const collection = {
      id: "col-1",
      name: "Workspace",
      folders: {
        [RootCollectionFolderId]: {
          id: RootCollectionFolderId,
          name: "Root",
          parentId: null,
          order: 0,
          childFolderIds: ["folder-a"],
          requestIds: ["req-1"],
        },
        "folder-a": {
          id: "folder-a",
          name: "Folder A",
          parentId: RootCollectionFolderId,
          order: 1,
          childFolderIds: [],
          requestIds: [],
        },
      },
      requestIndex: {
        "req-1": { folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId] },
      },
    }

    stateRefs.useCollection.mockReturnValue({ state: { collection } })
    stateRefs.collectionsApi.mockReturnValue({
      moveRequestToFolder: vi.fn(),
      getRequest: vi.fn(() => ({ id: "req-1", name: "Fetch" })),
    })
  })

  it("dispatches payloads for rename/duplicate/move/copy/delete", async () => {
    const user = userEvent.setup()
    const onAction = renderMenu()

    await user.click(screen.getByText("Rename"))
    expect(onAction).toHaveBeenNthCalledWith(1, {
      actionId: "rename",
      kind: "request",
      collectionId: "col-1",
      requestId: "req-1",
      name: "Fetch",
    })

    await user.click(screen.getByText("Duplicate"))
    expect(onAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ actionId: "duplicate" }))

    await user.hover(screen.getByText(/move to folder/i))
    await user.click(await screen.findByText("Root / Folder A"))
    expect(onAction).toHaveBeenCalledWith({
      actionId: "request:move",
      kind: "request",
      collectionId: "col-1",
      requestId: "req-1",
      name: "Fetch",
      targetFolderId: "folder-a",
    })

    await user.click(screen.getByText("Copy as JSON"))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ actionId: "copy-json" }))

    await user.click(screen.getByText("Delete"))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ actionId: "delete" }))

    expect(onAction).toHaveBeenCalledTimes(5)
  })

  it("only renders copy/delete for scratch requests", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <RequestMenuContent
          collectionId="col-1"
          requestId="req-1"
          requestName="Scratch"
          isScratch
          onAction={onAction}
        />
      </DropdownMenu>
    )

    expect(screen.queryByText("Rename")).not.toBeInTheDocument()
    expect(screen.queryByText("Duplicate")).not.toBeInTheDocument()
    expect(screen.queryByText(/move to folder/i)).not.toBeInTheDocument()

    await user.click(screen.getByText("Copy as JSON"))
    await user.click(screen.getByText("Delete"))

    expect(onAction).toHaveBeenCalledTimes(2)
    expect(onAction).toHaveBeenNthCalledWith(1, expect.objectContaining({ actionId: "copy-json" }))
    expect(onAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ actionId: "delete" }))
  })
})
