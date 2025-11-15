import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { FolderMenuPayload } from "@/components/ui/knurl/folder-menu"
import type { RequestMenuPayload } from "@/components/ui/knurl/request-menu"
import { RootCollectionFolderId } from "@/types"

const stateRefs = {
  requestTab: null as any,
  collection: null as any,
  collectionsApi: null as any,
  requestTabsApi: null as any,
}

const menuRefs = vi.hoisted(() => ({
  requestMenuProps: null as any,
  folderMenuProps: null as any,
  renameDialogProps: null as any,
  deleteDialogProps: null as any,
}))

vi.mock("@/state", () => ({
  useRequestTab: vi.fn(() => stateRefs.requestTab),
  useCollection: vi.fn(() => ({ state: { collection: stateRefs.collection } })),
  useCollections: vi.fn(() => ({
    state: { collectionsIndex: [] },
    actions: { collectionsApi: () => stateRefs.collectionsApi },
  })),
  isScratchCollection: vi.fn(() => false),
}))

vi.mock("@/components/ui/knurl/collection-menu", () => ({
  CollectionMenuContent: () => <div data-testid="collection-menu-content" />,
}))

vi.mock("@/components/ui/knurl/folder-menu", () => ({
  FolderMenuContent: (props: any) => {
    menuRefs.folderMenuProps = props
    return <div data-testid="folder-menu-content" />
  },
}))

vi.mock("@/components/ui/knurl/request-menu", () => ({
  RequestMenuContent: (props: any) => {
    menuRefs.requestMenuProps = props
    return <div data-testid="request-menu-content" />
  },
}))

vi.mock("@/components/ui/knurl/rename-dialog", () => ({
  __esModule: true,
  default: (props: any) => {
    menuRefs.renameDialogProps = props
    return (
      <div data-testid="rename-dialog">
        <span>{props.title}</span>
      </div>
    )
  },
}))

vi.mock("@/components/shared/delete-dialog", () => ({
  __esModule: true,
  default: (props: any) => {
    menuRefs.deleteDialogProps = props
    return <div data-testid="delete-dialog" />
  },
}))

import { Breadcrumbs } from "./breadcrumbs"

const baseCollection = () => ({
  id: "col-1",
  name: "Workspace",
  folders: {
    [RootCollectionFolderId]: {
      id: RootCollectionFolderId,
      name: "root",
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
      requestIds: ["req-2"],
    },
  },
  requestIndex: {
    "req-1": { folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId] },
    "req-2": { folderId: "folder-a", ancestry: [RootCollectionFolderId, "folder-a"] },
  },
})

const createCollectionsApi = () => ({
  duplicateRequest: vi.fn(),
  moveRequestToFolder: vi.fn(),
  updateRequest: vi.fn(),
  renameFolder: vi.fn(),
  createFolder: vi.fn(),
  deleteRequest: vi.fn(),
  deleteFolder: vi.fn(),
  getRequest: vi.fn(() => ({ id: "req-1", name: "Workspace Request" })),
})

const createRequestTabsApi = () => ({
  createRequestTab: vi.fn(),
  loadTab: vi.fn().mockResolvedValue(undefined),
  getOpenTab: vi.fn(() => undefined),
  removeTab: vi.fn(),
})

const baseRequestTab = (collectionId = "col-1", requestId = "req-1") => ({
  state: {
    activeTab: { collectionId, tabId: "tab-1" },
    request: { id: requestId, name: "Workspace Request", collectionId },
    original: { id: requestId },
    isDirty: false,
  },
  actions: { requestTabsApi: stateRefs.requestTabsApi },
})

const triggerRequestAction = async (payload: Partial<RequestMenuPayload> & { actionId: RequestMenuPayload["actionId"] }) => {
  if (!menuRefs.requestMenuProps) {
    throw new Error("request menu props not set")
  }
  await act(async () => {
    await menuRefs.requestMenuProps.onAction({
      collectionId: "col-1",
      requestId: "req-1",
      name: "Workspace Request",
      ...payload,
    })
  })
}

const triggerFolderAction = async (payload: Partial<FolderMenuPayload> & { actionId: FolderMenuPayload["actionId"] }) => {
  if (!menuRefs.folderMenuProps) {
    throw new Error("folder menu props not set")
  }
  await act(async () => {
    await menuRefs.folderMenuProps.onAction({
      collectionId: "col-1",
      folderId: "folder-a",
      parentId: RootCollectionFolderId,
      name: "Folder A",
      ...payload,
    })
  })
}

describe("Breadcrumbs", () => {
  beforeEach(() => {
    stateRefs.collection = baseCollection()
    stateRefs.collectionsApi = createCollectionsApi()
    stateRefs.requestTabsApi = createRequestTabsApi()
    stateRefs.requestTab = baseRequestTab()
    menuRefs.requestMenuProps = null
    menuRefs.folderMenuProps = null
    menuRefs.renameDialogProps = null
    menuRefs.deleteDialogProps = null
    ;(navigator as Navigator & { clipboard?: { writeText: (value: string) => Promise<void> } }).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    }
  })

  it("renders a placeholder when no active tab is selected", () => {
    stateRefs.requestTab = null
    const { container } = render(<Breadcrumbs />)
    expect(container.querySelector("[data-test-id='breadcrumbs']")).toBeNull()
  })

  it("shows rename dialog context for request actions", async () => {
    render(<Breadcrumbs />)
    await triggerRequestAction({ actionId: "rename" })
    await waitFor(() => expect(menuRefs.renameDialogProps).toBeTruthy())
    expect(menuRefs.renameDialogProps?.title).toContain("Rename Request")
    menuRefs.renameDialogProps?.onRename("Renamed", menuRefs.renameDialogProps.context)
    expect(stateRefs.collectionsApi.updateRequest).toHaveBeenCalledWith("col-1", "req-1", { name: "Renamed" })
  })

  it("duplicates a request by loading the tab first", async () => {
    render(<Breadcrumbs />)
    await triggerRequestAction({ actionId: "duplicate" })
    expect(stateRefs.requestTabsApi.loadTab).toHaveBeenCalledWith("col-1", "req-1")
    expect(stateRefs.collectionsApi.duplicateRequest).toHaveBeenCalledWith("col-1", "req-1")
  })

  it("moves a request when a target folder is chosen", async () => {
    render(<Breadcrumbs />)
    await triggerRequestAction({ actionId: "request:move", targetFolderId: "folder-a" })
    expect(stateRefs.collectionsApi.moveRequestToFolder).toHaveBeenCalledWith("col-1", "req-1", "folder-a")
  })

  it("copies request JSON to the clipboard", async () => {
    render(<Breadcrumbs />)
    await triggerRequestAction({ actionId: "copy" })
    const clipboard = navigator.clipboard as { writeText: ReturnType<typeof vi.fn> }
    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Workspace Request"))
  })

  it("opens delete dialog and removes tabs when confirming request removal", async () => {
    stateRefs.requestTabsApi.getOpenTab = vi.fn(() => ({ tabId: "tab-99" }))
    render(<Breadcrumbs />)
    await triggerRequestAction({ actionId: "delete" })
    await waitFor(() => expect(menuRefs.deleteDialogProps).toBeTruthy())
    await menuRefs.deleteDialogProps?.onDelete(menuRefs.deleteDialogProps.context)
    expect(stateRefs.requestTabsApi.removeTab).toHaveBeenCalledWith("tab-99")
    expect(stateRefs.collectionsApi.deleteRequest).toHaveBeenCalledWith("col-1", "req-1")
  })

  it("handles folder creation and rename from menu actions", async () => {
    stateRefs.requestTab = baseRequestTab("col-1", "req-2")
    render(<Breadcrumbs />)
    await triggerFolderAction({ actionId: "folder:new" })
    await waitFor(() => expect(menuRefs.renameDialogProps).toBeTruthy())
    expect(menuRefs.renameDialogProps?.title).toContain("Create Folder")
    await triggerFolderAction({ actionId: "folder:rename" })
    await waitFor(() => expect(menuRefs.renameDialogProps?.title).toContain("Rename Folder"))
    expect(menuRefs.renameDialogProps?.title).toContain("Rename Folder")
  })

  it("deletes folders and associated tabs", async () => {
    stateRefs.requestTab = baseRequestTab("col-1", "req-2")
    stateRefs.requestTabsApi.getOpenTab = vi.fn(() => ({ tabId: "tab-folder" }))
    render(<Breadcrumbs />)
    await triggerFolderAction({ actionId: "delete" })
    await waitFor(() => expect(menuRefs.deleteDialogProps).toBeTruthy())
    await menuRefs.deleteDialogProps?.onDelete(menuRefs.deleteDialogProps.context)
    expect(stateRefs.requestTabsApi.removeTab).toHaveBeenCalledWith("tab-folder")
    expect(stateRefs.collectionsApi.deleteFolder).toHaveBeenCalledWith("col-1", "folder-a")
  })
})
