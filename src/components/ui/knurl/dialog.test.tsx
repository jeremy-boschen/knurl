import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

vi.mock("react-draggable", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from "./dialog"

const renderDialog = (content: ReactNode, props: Record<string, any> = {}) =>
  render(
    <Dialog open modal={false} onOpenChange={() => {}} {...props}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent>{content}</DialogContent>
      </DialogPortal>
    </Dialog>,
  )

describe("Knurl Dialog", () => {
  it("renders close button by default when open", () => {
    renderDialog(<DialogTitle>Sample</DialogTitle>)
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument()
  })

  it("omits close button when disabled", () => {
    renderDialog(<DialogTitle>Sample</DialogTitle>, { showCloseButton: false })
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull()
  })

  it("marks title as draggable by default and removes handle when draggable is false", () => {
    const { rerender } = renderDialog(<DialogTitle>Drag Me</DialogTitle>)
    expect(document.querySelector("[data-slot='dialog-title']")?.className).toMatch(/draggable-dialog-title/)

    rerender(
      <Dialog open modal={false} draggable={false} onOpenChange={() => {}}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent>
            <DialogTitle>Static</DialogTitle>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    )

    expect(document.querySelector("[data-slot='dialog-title']")?.className).not.toMatch(/draggable-dialog-title/)
  })

  it("renders resize handle when resizable with size provided", () => {
    render(
      <Dialog open modal={false} resizable size={{ min: { width: 200, height: 200 } }} onOpenChange={() => {}}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent>
            <DialogTitle>Resizable</DialogTitle>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    )

    expect(document.querySelector('[class*="resize-handle-"]')).toBeInTheDocument()
  })
})
