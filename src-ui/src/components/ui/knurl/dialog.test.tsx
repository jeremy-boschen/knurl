import React, { type ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const dialogContentHandlers = vi.hoisted(() => ({
  onPointerDownOutside: null as ((event: { preventDefault: () => void }) => void) | null,
  onInteractOutside: null as ((event: { preventDefault: () => void }) => void) | null,
}))

vi.mock("react-draggable", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@radix-ui/react-dialog", async () => {
  const actual = await vi.importActual<typeof import("@radix-ui/react-dialog")>("@radix-ui/react-dialog")
  return {
    ...actual,
    Content: React.forwardRef((props: any, ref: any) => {
      dialogContentHandlers.onPointerDownOutside = props.onPointerDownOutside
      dialogContentHandlers.onInteractOutside = props.onInteractOutside
      return <actual.Content {...props} ref={ref} />
    }),
  }
})

import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "./dialog"

const renderDialog = (content: ReactNode, props: Record<string, any> = {}) =>
  render(
    <Dialog open modal={false} onOpenChange={() => {}} {...props}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent aria-describedby="dialog-description">
          <DialogDescription id="dialog-description">Dialog body</DialogDescription>
          {content}
        </DialogContent>
      </DialogPortal>
    </Dialog>,
  )

describe("Knurl Dialog", () => {
  const consoleError = console.error
  const consoleWarn = console.warn

  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
      if (typeof args[0] === "string" && args[0].includes("Missing `Description`")) {
        // Radix dev warning is noisy in tests; description is provided in fixtures.
        return
      }
      consoleError(...args)
    })
    vi.spyOn(console, "warn").mockImplementation((...args: any[]) => {
      if (typeof args[0] === "string" && args[0].includes("Missing `Description`")) {
        return
      }
      consoleWarn(...args)
    })
  })

  afterAll(() => {
    ;(console.error as any).mockRestore?.()
    ;(console.warn as any).mockRestore?.()
  })

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
          <DialogContent aria-describedby="dialog-description">
            <DialogDescription id="dialog-description">Dialog content</DialogDescription>
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
          <DialogContent aria-describedby="dialog-description">
            <DialogDescription id="dialog-description">Dialog content</DialogDescription>
            <DialogTitle>Resizable</DialogTitle>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    )

    expect(document.querySelector('[class*="resize-handle-"]')).toBeInTheDocument()
  })

  it("updates container size when dragging the resize handle", async () => {
    render(
      <Dialog
        open
        modal={false}
        resizable
        size={{ min: { width: 180, height: 150 }, initial: { width: 220, height: 200 } }}
        onOpenChange={() => {}}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogContent aria-describedby="dialog-description">
            <DialogDescription id="dialog-description">Dialog content</DialogDescription>
            <DialogTitle>Resize</DialogTitle>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    )

    const handle = document.querySelector('[class*="resize-handle-"]') as HTMLElement
    const draggableContainer = document.querySelector("[data-slot='dialog-content']")?.parentElement as HTMLElement
    expect(draggableContainer.style.width).toBe("220px")

    await act(async () => {
      fireEvent.mouseDown(handle, { clientX: 200, clientY: 200 })
    })
    expect(document.body.style.cursor).toBe("se-resize")
    expect(document.body.style.userSelect).toBe("none")

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 260, clientY: 250 }))
    })
    await act(async () => {
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 260, clientY: 250 }))
    })

    await waitFor(() => {
      expect(draggableContainer.style.width).toBe("280px")
      expect(draggableContainer.style.height).toBe("250px")
    })
    expect(document.body.style.cursor).toBe("")
    expect(document.body.style.userSelect).toBe("")
  })

  it("prevents outside interactions while resizing but allows them otherwise", () => {
    render(
      <Dialog
        open
        modal={false}
        resizable
        size={{ min: { width: 150, height: 120 }, initial: { width: 200, height: 180 } }}
        onOpenChange={() => {}}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogContent aria-describedby="dialog-description">
            <DialogDescription id="dialog-description">Dialog content</DialogDescription>
            <DialogTitle>Guard</DialogTitle>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    )

    const handle = document.querySelector('[class*="resize-handle-"]') as HTMLElement

    act(() => {
      fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 })
    })
    const preventDefault = vi.fn()
    dialogContentHandlers.onPointerDownOutside?.({ preventDefault } as any)
    expect(preventDefault).toHaveBeenCalled()

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 120, clientY: 120 }))
    })

    const preventDefaultIdle = vi.fn()
    dialogContentHandlers.onPointerDownOutside?.({ preventDefault: preventDefaultIdle } as any)
    expect(preventDefaultIdle).not.toHaveBeenCalled()
  })
})
