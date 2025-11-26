import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import { NewCollectionDialog } from "./new-collection-dialog"

const hoisted = vi.hoisted(() => ({
  useCollections: vi.fn(),
}))

vi.mock("@/state", () => hoisted)

vi.mock("@/components/ui/dialog", () => {
  const React = require("react") as typeof import("react")
  const DialogContext = React.createContext<{ onOpenChange?: (open: boolean) => void }>({})

  const Dialog = ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void }) => (
    <div data-testid="mock-dialog">
      <DialogContext.Provider value={{ onOpenChange }}>{children}</DialogContext.Provider>
    </div>
  )

  const wrap = (Tag: keyof JSX.IntrinsicElements) =>
    function Component({ children, ...props }: React.HTMLAttributes<HTMLElement>) {
      return React.createElement(Tag, props, children)
    }

  const DialogContent = wrap("section")
  const DialogHeader = wrap("header")
  const DialogTitle = wrap("h2")
  const DialogDescription = wrap("p")
  const DialogFooter = wrap("footer")

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

  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose }
})

describe("NewCollectionDialog", () => {
  const addCollection = vi.fn()
  const collectionsApi = vi.fn(() => ({ addCollection }))

  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.useCollections.mockReturnValue({
      actions: {
        collectionsApi,
      },
    })
  })

  it("returns null when closed", () => {
    const { container } = render(<NewCollectionDialog open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it("validates and submits a new collection", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<NewCollectionDialog open onClose={onClose} />)

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    await user.type(nameInput, "  Sample API  ")
    const descriptionInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement
    await user.type(descriptionInput, "Docs only")

    await user.click(screen.getByRole("button", { name: /Create Collection/i }))

    expect(addCollection).toHaveBeenCalledWith("Sample API", "Docs only")
    expect(onClose).toHaveBeenCalled()
  })

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup()
    render(<NewCollectionDialog open onClose={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Create Collection/i }))
    expect(await screen.findByText(/Collection name is required/i)).toBeInTheDocument()
    expect(addCollection).not.toHaveBeenCalled()
  })

  it("invokes onClose when Cancel is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<NewCollectionDialog open onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: /Cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
