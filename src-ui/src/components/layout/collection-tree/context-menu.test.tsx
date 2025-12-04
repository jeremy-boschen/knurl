import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => {
  const RootCollectionFolderId = "root"
  const baseCollection = {
    id: "col-1",
    name: "Alpha",
    description: "",
    encryption: { algorithm: "aes-gcm" as const },
    authentication: { type: "none" },
    folders: {
      [RootCollectionFolderId]: {
        id: RootCollectionFolderId,
        name: "Root",
        parentId: null,
        order: 0,
        childFolderIds: ["folder-a", "folder-b", "folder-c"],
        requestIds: ["req-1"],
      },
      "folder-a": {
        id: "folder-a",
        name: "Folder A",
        parentId: RootCollectionFolderId,
        order: 0,
        childFolderIds: ["folder-child"],
        requestIds: [],
      },
      "folder-b": {
        id: "folder-b",
        name: "Folder B",
        parentId: RootCollectionFolderId,
        order: 1,
        childFolderIds: [],
        requestIds: [],
      },
      "folder-c": {
        id: "folder-c",
        name: "Folder C",
        parentId: RootCollectionFolderId,
        order: 2,
        childFolderIds: [],
        requestIds: [],
      },
      "folder-child": {
        id: "folder-child",
        name: "Child",
        parentId: "folder-a",
        order: 0,
        childFolderIds: [],
        requestIds: [],
      },
    },
    requests: {
      "req-1": {
        id: "req-1",
        name: "Get Users",
        method: "GET",
        url: "/users",
        authentication: { type: "none" },
        headers: [],
        query: [],
        body: { type: "json", value: "" },
        variables: [],
        patch: null,
        folderId: RootCollectionFolderId,
      },
    },
    requestIndex: {
      "req-1": { folderId: RootCollectionFolderId, ancestry: [] },
    },
    environments: {},
  }

  const reset = () => ({
    collectionsIndex: [
      { id: "col-1", name: "Alpha", order: 0 },
      { id: "col-2", name: "Beta", order: 1 },
      { id: "col-3", name: "Gamma", order: 2 },
    ],
    collections: {
      "col-1": structuredClone(baseCollection),
      "col-2": structuredClone(baseCollection),
      "col-3": structuredClone(baseCollection),
    },
    collectionsApi: {
      reorderCollections: vi.fn(),
      loadCollection: vi.fn(async () => {}),
      createRequest: vi.fn(),
      createFolder: vi.fn(),
      updateCollection: vi.fn(),
      getCollection: vi.fn(() => baseCollection),
      removeCollection: vi.fn(),
      moveFolder: vi.fn(),
      reorderFolders: vi.fn(),
      renameFolder: vi.fn(),
      deleteFolder: vi.fn(),
      duplicateRequest: vi.fn(),
      moveRequestToFolder: vi.fn(),
      updateRequest: vi.fn(),
      deleteRequest: vi.fn(),
      getRequest: vi.fn(() => baseCollection.requests["req-1"]),
    },
    dialogsApi: {
      showCreateRequestDialog: vi.fn(),
      showCreateFolderDialog: vi.fn(),
      showRenameDialog: vi.fn(),
      showDeleteDialog: vi.fn(),
    },
    utilitySheetsApi: {
      openSheet: vi.fn(),
    },
  })

  let current = reset()

  return {
    get current() {
      return current
    },
    reset: () => {
      current = reset()
    },
  }
})

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}))

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children, onOpenChange }: any) => (
    <div data-testid="context-menu-root" onContextMenu={() => onOpenChange?.(true)} onMouseLeave={() => onOpenChange?.(false)}>
      {children}
    </div>
  ),
  ContextMenuTrigger: ({ children, onContextMenu }: any) =>
    React.cloneElement(children, {
      onContextMenu,
    }),
  ContextMenuContent: ({ children }: any) => <div data-testid="context-menu-content">{children}</div>,
  ContextMenuItem: ({ children, onClick, disabled }: any) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <div data-testid="separator" />,
  ContextMenuSub: ({ children }: any) => <div>{children}</div>,
  ContextMenuSubTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  ContextMenuSubContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/state", () => ({
  useCollections: () => ({ state: { collectionsIndex: state.current.collectionsIndex } }),
  collectionsApi: () => state.current.collectionsApi,
  dialogsApi: () => state.current.dialogsApi,
  utilitySheetsApi: () => state.current.utilitySheetsApi,
}))

vi.mock("@/state/application", () => ({
  useCollection: (collectionId: string) => ({ state: { collection: state.current.collections[collectionId] } }),
}))

let CollectionContextMenu: typeof import("./context-menu")["CollectionContextMenu"]
let CollectionMenu: typeof import("./context-menu/collection-menu")["CollectionMenu"]
let FolderMenu: typeof import("./context-menu/folder-menu")["FolderMenu"]
let RequestMenu: typeof import("./context-menu/request-menu")["RequestMenu"]

beforeAll(async () => {
  ;({ CollectionContextMenu } = await import("./context-menu"))
  ;({ CollectionMenu } = await import("./context-menu/collection-menu"))
  ;({ FolderMenu } = await import("./context-menu/folder-menu"))
  ;({ RequestMenu } = await import("./context-menu/request-menu"))
})

beforeEach(() => {
  state.reset()
  vi.clearAllMocks()
})

describe("CollectionContextMenu", () => {
  it("opens the correct menu based on the target kind", async () => {
    render(
      <CollectionContextMenu>
        <div>
          <div data-kind="collection" data-collection-id="col-1" data-name="Alpha">
            Alpha
          </div>
          <div data-kind="folder" data-collection-id="col-1" data-folder-id="folder-a" data-name="Folder A">
            Folder A
          </div>
          <div data-kind="request" data-collection-id="col-1" data-request-id="req-1" data-name="Get Users">
            Get Users
          </div>
        </div>
      </CollectionContextMenu>,
    )

    await act(async () => {
      fireEvent.contextMenu(screen.getByText("Alpha"))
    })
    expect(screen.getByText("Rename Collection")).toBeInTheDocument()

    await act(async () => {
      fireEvent.contextMenu(screen.getByText("Folder A"))
    })
    expect(screen.getByText("Rename Folder")).toBeInTheDocument()
    expect(screen.queryByText("Rename Collection")).toBeNull()

    await act(async () => {
      fireEvent.contextMenu(screen.getByText("Get Users"))
    })
    expect(screen.getByText("Duplicate")).toBeInTheDocument()
  })
})

describe("CollectionMenu", () => {
  it("reorders collections up and down", async () => {
    const user = userEvent.setup()
    render(<CollectionMenu item={{ kind: "collection", collectionId: "col-2", name: "Beta" }} />)

    await user.click(screen.getByText("Move Up"))
    expect(state.current.collectionsApi.reorderCollections).toHaveBeenCalledWith(["col-2", "col-1", "col-3"])

    await user.click(screen.getByText("Move Down"))
    expect(state.current.collectionsApi.reorderCollections).toHaveBeenCalledWith(["col-1", "col-3", "col-2"])
  })

  it("opens dialogs and sheets for collection actions", async () => {
    const user = userEvent.setup()
    render(<CollectionMenu item={{ kind: "collection", collectionId: "col-1", name: "Alpha" }} />)

    await user.click(screen.getByText("New Request"))
    expect(state.current.dialogsApi.showCreateRequestDialog).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: "col-1", parentId: "root" }),
    )

    await user.click(screen.getByText("New Folder"))
    expect(state.current.dialogsApi.showCreateFolderDialog).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: "col-1", parentId: "root" }),
    )

    await user.click(screen.getByText("Rename Collection"))
    expect(state.current.dialogsApi.showRenameDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rename Collection", name: "Alpha" }),
    )

    await user.click(screen.getByText("Manage Settings"))
    expect(state.current.utilitySheetsApi.openSheet).toHaveBeenCalledWith({
      type: "collection-settings",
      context: { collectionId: "col-1" },
    })

    await user.click(screen.getByText("Export Collection"))
    expect(state.current.utilitySheetsApi.openSheet).toHaveBeenCalledWith({
      type: "export",
      context: { collectionId: "col-1" },
    })

    await user.click(screen.getByText("Copy as JSON"))
    expect(state.current.collectionsApi.getCollection).toHaveBeenCalledWith("col-1")

    await user.click(screen.getByText("Delete Collection"))
    expect(state.current.dialogsApi.showDeleteDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Delete Collection" }),
    )
  })
})

describe("FolderMenu", () => {
  it("reorders sibling folders and moves to another folder", async () => {
    const user = userEvent.setup()
    render(<FolderMenu item={{ kind: "folder", collectionId: "col-1", folderId: "folder-b", name: "Folder B" }} />)

    await user.click(screen.getByText("Move Up"))
    expect(state.current.collectionsApi.reorderFolders).toHaveBeenCalledWith("col-1", "root", [
      "folder-b",
      "folder-a",
      "folder-c",
    ])

    await user.click(screen.getByText("Move Down"))
    expect(state.current.collectionsApi.reorderFolders).toHaveBeenCalledWith("col-1", "root", [
      "folder-a",
      "folder-c",
      "folder-b",
    ])

    await user.click(screen.getByText("Root / Folder A / Child"))
    expect(state.current.collectionsApi.moveFolder).toHaveBeenCalledWith("col-1", "folder-b", "folder-child")
  })

  it("triggers folder dialogs", async () => {
    const user = userEvent.setup()
    render(<FolderMenu item={{ kind: "folder", collectionId: "col-1", folderId: "folder-b", name: "Folder B" }} />)

    await user.click(screen.getByText("New Request"))
    expect(state.current.dialogsApi.showCreateRequestDialog).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: "col-1", parentId: "folder-b" }),
    )

    await user.click(screen.getByText("New Folder"))
    expect(state.current.dialogsApi.showCreateFolderDialog).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: "col-1", parentId: "folder-b" }),
    )

    await user.click(screen.getByText("Rename Folder"))
    expect(state.current.dialogsApi.showRenameDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rename Folder", name: "Folder B" }),
    )

    await user.click(screen.getByText("Delete Folder"))
    expect(state.current.dialogsApi.showDeleteDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Delete Folder" }),
    )
  })
})

describe("RequestMenu", () => {
  it("moves, duplicates, copies, renames, and deletes requests", async () => {
    const user = userEvent.setup()
    render(<RequestMenu item={{ kind: "request", collectionId: "col-1", requestId: "req-1", name: "Get Users" }} />)

    await user.click(screen.getByText("Rename"))
    expect(state.current.dialogsApi.showRenameDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rename Request", name: "Get Users" }),
    )

    await user.click(screen.getByText("Duplicate"))
    expect(state.current.collectionsApi.duplicateRequest).toHaveBeenCalledWith("col-1", "req-1")

    await user.click(screen.getByText("Move to folder"))
    await user.click(screen.getByText("Root / Folder A"))
    expect(state.current.collectionsApi.moveRequestToFolder).toHaveBeenCalledWith("col-1", "req-1", "folder-a")

    await user.click(screen.getByText("Copy as JSON"))
    expect(state.current.collectionsApi.getRequest).toHaveBeenCalledWith("col-1", "req-1")

    await user.click(screen.getByText("Delete"))
    expect(state.current.dialogsApi.showDeleteDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Delete Request" }),
    )
  })
})
