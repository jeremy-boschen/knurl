import { describe, expect, it, vi } from "vitest"

import { dialogsSliceCreator } from "./dialogs"

describe("dialogsSliceCreator", () => {
  const createSlice = () => {
    let app: any
    const set = (fn: (draft: any) => void) => fn(app)
    const slice = dialogsSliceCreator(set as any)
    app = { ...slice }
    return { app, api: slice.dialogsApi }
  }

  it("opens delete dialog with payload and closes", () => {
    const { app, api } = createSlice()
    const onConfirm = vi.fn()
    api.showDeleteDialog({ title: "Delete", description: "Desc", context: { kind: "request", id: "r1" }, onConfirm })
    expect(app.dialogsState.activeDialog).toMatchObject({
      kind: "delete",
      title: "Delete",
      description: "Desc",
    })
    api.closeDialog()
    expect(app.dialogsState.activeDialog).toBeNull()
  })

  it("opens rename dialog with context and name", () => {
    const { app, api } = createSlice()
    api.showRenameDialog({
      title: "Rename",
      description: "Desc",
      name: "Old",
      context: { kind: "folder", id: "f1", parentId: "root" },
      onConfirm: vi.fn(),
    })
    expect(app.dialogsState.activeDialog).toMatchObject({
      kind: "rename",
      name: "Old",
      context: { id: "f1" },
    })
  })

  it("opens create dialogs", () => {
    const { app, api } = createSlice()
    api.showCreateCollectionDialog({ onConfirm: vi.fn() })
    expect(app.dialogsState.activeDialog?.kind).toBe("create-collection")

    api.showCreateFolderDialog({ collectionId: "c1", parentId: "root", onConfirm: vi.fn() })
    expect(app.dialogsState.activeDialog).toMatchObject({
      kind: "create-folder",
      collectionId: "c1",
      parentId: "root",
    })

    api.showCreateRequestDialog({ collectionId: "c1", parentId: "root", onConfirm: vi.fn() })
    expect(app.dialogsState.activeDialog?.kind).toBe("create-request")

    api.showSaveRequestDialog({ onConfirm: vi.fn() })
    expect(app.dialogsState.activeDialog?.kind).toBe("save-request")
  })
})
