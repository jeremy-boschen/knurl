import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreateCollectionDialog } from "./create-collection-dialog"
import { CreateFolderDialog } from "./create-folder-dialog"
import { CreateRequestDialog } from "./create-request-dialog"
import { DeleteDialog } from "./delete-dialog"
import { RenameDialog } from "./rename-dialog"
import { SaveRequestDialog } from "./save-request-dialog"

// Mock UI shells to avoid Radix portal/aria noise
vi.mock("@/components/ui/dialog", () => {
  const React = require("react")
  const Dialog = ({ open, onOpenChange, children }: any) =>
    open ? <div data-role="dialog" onClose={() => onOpenChange?.(false)}>{children}</div> : null
  const Passthrough = ({ children, ...rest }: any) => <div {...rest}>{children}</div>
  return {
    Dialog,
    DialogContent: Passthrough,
    DialogDescription: ({ children }: any) => <p>{children}</p>,
    DialogFooter: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: ({ children }: any) => <h1>{children}</h1>,
  }
})

vi.mock("@/components/ui/alert-dialog", () => {
  const React = require("react")
  const AlertDialog = ({ open, onOpenChange, children }: any) =>
    open ? <div data-role="alert" onClose={() => onOpenChange?.(false)}>{children}</div> : null
  const Passthrough = ({ children, ...rest }: any) => <div {...rest}>{children}</div>
  const Button = ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  )
  return {
    AlertDialog,
    AlertDialogContent: Passthrough,
    AlertDialogHeader: Passthrough,
    AlertDialogFooter: Passthrough,
    AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
    AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
    AlertDialogCancel: Button,
    AlertDialogAction: Button,
  }
})

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...rest }: any) => (
    <input value={value} onChange={onChange} {...rest} data-testid="input" />
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}))

// Lightweight select mock to exercise selection flow
import React from "react"
const SelectContext = React.createContext<(value: string) => void>(() => {})
vi.mock("@/components/ui/select", () => {
  const Select = ({ onValueChange, children }: any) => (
    <SelectContext.Provider value={onValueChange}>{children}</SelectContext.Provider>
  )
  const SelectTrigger = ({ children }: any) => <div>{children}</div>
  const SelectContent = ({ children }: any) => <div>{children}</div>
  const SelectItem = ({ value, children }: any) => {
    const onValueChange = React.useContext(SelectContext)
    return (
      <button type="button" onClick={() => onValueChange(value)}>
        {children}
      </button>
    )
  }
  const SelectValue = ({ placeholder }: any) => <span>{placeholder}</span>
  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
})

// Mock collections for SaveRequestDialog
vi.mock("@/state", () => ({
  useCollections: () => ({
    state: { collectionsIndex: [{ id: "col-1", name: "Workspace" }] },
  }),
}))

describe("dialog components", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Create dialogs capture name, reset, and cancel", async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    const { rerender } = render(
      <CreateCollectionDialog open onConfirm={onConfirm} onCancel={onCancel} />,
    )
    await user.type(screen.getByTestId("input"), " New Collection ")
    await user.click(screen.getByRole("button", { name: /create/i }))
    expect(onConfirm).toHaveBeenCalledWith({ name: "New Collection" })
    expect(onCancel).toHaveBeenCalledTimes(1)

    rerender(<CreateFolderDialog open onConfirm={onConfirm} onCancel={onCancel} />)
    await user.type(screen.getByTestId("input"), " Folder ")
    await user.click(screen.getByRole("button", { name: /create/i }))
    expect(onConfirm).toHaveBeenCalledWith({ name: "Folder" })

    rerender(<CreateRequestDialog open onConfirm={onConfirm} onCancel={onCancel} />)
    await user.type(screen.getByTestId("input"), " Request ")
    await user.click(screen.getByRole("button", { name: /create/i }))
    expect(onConfirm).toHaveBeenCalledWith({ name: "Request" })
  })

  it("Rename dialog disables when unchanged and confirms with trimmed value", async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <RenameDialog
        open
        title="Rename"
        description="desc"
        name="Original"
        context={{ kind: "request", id: "r1", collectionId: "c1" }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    const renameBtn = screen.getByRole("button", { name: /rename/i })
    expect(renameBtn).toBeDisabled()

    await user.clear(screen.getByTestId("input"))
    await user.type(screen.getByTestId("input"), " Updated ")
    expect(renameBtn).not.toBeDisabled()

    await user.click(renameBtn)
    expect(onConfirm).toHaveBeenCalledWith(
      { kind: "request", id: "r1", collectionId: "c1" },
      "Updated",
    )
  })

  it("Delete dialog calls confirm and cancel hooks", async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <DeleteDialog
        open
        title="Delete item"
        description="Remove"
        context={{ kind: "folder", id: "f1", collectionId: "c1" }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole("button", { name: /delete/i }))
    expect(onConfirm).toHaveBeenCalledWith({ kind: "folder", id: "f1", collectionId: "c1" })
    expect(onCancel).toHaveBeenCalled()
  })

  it("SaveRequestDialog selects a collection and saves", async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<SaveRequestDialog open onConfirm={onConfirm} onCancel={onCancel} />)

    await user.click(screen.getByText(/workspace/i))
    await user.click(screen.getByRole("button", { name: /save/i }))

    expect(onConfirm).toHaveBeenCalledWith({ collectionId: "col-1" })
  })
})
