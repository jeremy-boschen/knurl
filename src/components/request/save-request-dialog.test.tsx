import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import SaveRequestDialog from "./save-request-dialog"
import { createRequestFixture } from "@/test/fixtures/collections"

const stateMocks = vi.hoisted(() => ({
  useCollections: vi.fn(),
}))

vi.mock("@/state", () => ({
  useCollections: stateMocks.useCollections,
  ScratchCollectionId: "scratch",
}))

vi.mock("@/components/ui/knurl/dialog", () => {
  const React = require("react") as typeof import("react")
  const DialogContext = React.createContext<{ onOpenChange?: (next: boolean) => void }>({})

  const Dialog = ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void }) => (
    <div data-testid="mock-dialog">
      <DialogContext.Provider value={{ onOpenChange }}>{children}</DialogContext.Provider>
    </div>
  )

  const passthrough = (tag: string) =>
    function Component({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
      return React.createElement(tag, props, children)
    }

  const DialogHeader = passthrough("div")
  const DialogFooter = passthrough("div")
  const DialogContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  )
  const DialogTitle = passthrough("h2")
  const DialogDescription = passthrough("p")

  const DialogClose = ({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) => {
    const { onOpenChange } = React.useContext(DialogContext)
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          children.props?.onClick?.(event)
          onOpenChange?.(false)
        },
      })
    }
    return (
      <button type="button" onClick={() => onOpenChange?.(false)}>
        {children}
      </button>
    )
  }

  return {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  }
})

vi.mock("@/components/ui/select", () => {
  const React = require("react") as typeof import("react")
  const SelectContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

  const Select = ({ value, onValueChange, children }: any) => (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div data-testid="mock-select">{children}</div>
    </SelectContext.Provider>
  )

  const SelectTrigger = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  )

  const SelectContent = ({ children }: { children: React.ReactNode }) => <div role="listbox">{children}</div>

  const SelectItem = ({ value, children, ...props }: any) => {
    const ctx = React.useContext(SelectContext)
    return (
      <button type="button" {...props} onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
    )
  }

  const SelectValue = ({ placeholder }: { placeholder?: string }) => {
    const ctx = React.useContext(SelectContext)
    return <span>{ctx.value || placeholder}</span>
  }

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

describe("SaveRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stateMocks.useCollections.mockReturnValue({
      state: {
        collectionsIndex: [],
      },
    })
  })

  const getByDataId = (id: string): HTMLElement => {
    const el = document.querySelector(`[data-test-id="${id}"]`)
    if (!el) {
      throw new Error(`Missing ${id}`)
    }
    return el as HTMLElement
  }

  const renderDialog = (props?: Partial<React.ComponentProps<typeof SaveRequestDialog>>) => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const request = createRequestFixture({
      name: "  Sample Request  ",
      collectionId: "col-2",
    })

    const result = render(
      <SaveRequestDialog
        open
        onSave={onSave}
        onClose={onClose}
        request={request}
        {...props}
      />,
    )

    return { ...result, onSave, onClose }
  }

  it("returns null when closed", () => {
    const request = createRequestFixture()
    const { container } = render(
      <SaveRequestDialog open={false} onSave={vi.fn()} onClose={vi.fn()} request={request} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("prefills values and saves the request", async () => {
    const collectionsIndex = [
      { id: "col-1", name: "Beta", order: 2 },
      { id: "col-2", name: "Alpha", order: 1 },
      { id: "scratch", name: "Scratch", order: 0 },
    ]
    stateMocks.useCollections.mockReturnValue({ state: { collectionsIndex } })
    const { onSave, onClose } = renderDialog()
    const user = userEvent.setup()

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    await waitFor(() => expect(nameInput.value).toBe("Sample Request"))

    await user.clear(nameInput)
    await user.type(nameInput, "Updated Request")

    await user.click(getByDataId("save-request-dialog:collection-item:col-1"))
    await user.click(getByDataId("save-request-dialog:save-button"))

    expect(onSave).toHaveBeenCalledWith("col-1", "Updated Request")
    expect(onClose).toHaveBeenCalled()
  })

  it("shows validation errors when fields missing", async () => {
    const collectionsIndex = [
      { id: "col-a", name: "Alpha", order: 1 },
      { id: "col-b", name: "Beta", order: 2 },
    ]
    stateMocks.useCollections.mockReturnValue({ state: { collectionsIndex } })
    const request = createRequestFixture({ name: "", collectionId: "scratch" })
    render(
      <SaveRequestDialog open onSave={vi.fn()} onClose={vi.fn()} request={request} />,
    )

    const user = userEvent.setup()
    await user.click(getByDataId("save-request-dialog:save-button"))

    expect(await screen.findByText(/Request name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/Collection is required/i)).toBeInTheDocument()
  })

  it("disables save action when no collections exist", async () => {
    const request = createRequestFixture({ collectionId: "scratch" })
    const { getByText } = render(
      <SaveRequestDialog open onSave={vi.fn()} onClose={vi.fn()} request={request} />,
    )

    expect(getByText(/No collections available/i)).toBeInTheDocument()
    expect(getByDataId("save-request-dialog:save-button")).toBeDisabled()
  })

  it("invokes onClose when cancel is pressed", async () => {
    const { onClose } = renderDialog()
    const user = userEvent.setup()
    await user.click(getByDataId("save-request-dialog:cancel-button"))
    expect(onClose).toHaveBeenCalled()
  })
})
