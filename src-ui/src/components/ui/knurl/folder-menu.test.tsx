import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const stateRefs = vi.hoisted(() => ({
  useCollection: vi.fn(),
}))

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { CollectionFolderNode } from "@/types"
import { RootCollectionFolderId } from "@/types"
import { FolderMenuContent, type FolderMenuPayload } from "./folder-menu"

vi.mock("@/state", () => ({
  useCollection: stateRefs.useCollection,
}))

const folder: CollectionFolderNode = {
  id: "folder-1",
  name: "Requests",
  parentId: null,
  order: 0,
  childFolderIds: [],
  requestIds: [],
}

const renderMenu = (onAction: (payload: FolderMenuPayload) => void) => {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <button type="button">Open</button>
      </DropdownMenuTrigger>
      <FolderMenuContent collectionId="col-1" folder={folder} onAction={onAction} />
    </DropdownMenu>
  )
}

describe("FolderMenuContent", () => {
  beforeEach(() => {
    const collection = {
      id: "col-1",
      name: "Workspace",
      folders: {
        [RootCollectionFolderId]: {
          id: RootCollectionFolderId,
          name: "root",
          parentId: null,
          order: 0,
          childFolderIds: [folder.id],
          requestIds: [],
        },
        [folder.id]: { ...folder, parentId: RootCollectionFolderId },
      },
    }
    stateRefs.useCollection.mockReturnValue({ state: { collection } })
  })

  it("emits each folder action exactly once", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderMenu(onAction)

    await user.click(screen.getByText("New Request"))
    expect(onAction).toHaveBeenLastCalledWith({
      actionId: "request:new",
      kind: "folder",
      collectionId: "col-1",
      folderId: "folder-1",
      name: "Requests",
    })

    await user.click(screen.getByText("New Subfolder"))
    expect(onAction).toHaveBeenLastCalledWith({
      actionId: "folder:new",
      kind: "folder",
      collectionId: "col-1",
      folderId: "folder-1",
      parentId: "folder-1",
      name: "Requests",
    })

    await user.click(screen.getByText("Rename"))
    expect(onAction).toHaveBeenLastCalledWith({
      actionId: "folder:rename",
      kind: "folder",
      collectionId: "col-1",
      folderId: "folder-1",
      name: "Requests",
    })

    await user.click(screen.getByText("Delete"))
    expect(onAction).toHaveBeenLastCalledWith({
      actionId: "delete",
      kind: "folder",
      collectionId: "col-1",
      folderId: "folder-1",
      name: "Requests",
    })

    expect(onAction).toHaveBeenCalledTimes(4)
  })
})
