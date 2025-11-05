import type React from "react"

import { describe, expect, it } from "vitest"

import { page, render } from "@/test/testing-lib"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"

function renderBasic(open = true, extra?: React.ReactNode, props?: Partial<React.ComponentProps<typeof Dialog>>) {
  return render(
    <Dialog open={open} onOpenChange={() => {}} {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>My Dialog</DialogTitle>
        </DialogHeader>
        <div>Body</div>
        {extra}
      </DialogContent>
    </Dialog>,
  )
}

describe("Knurl Dialog", () => {
  it("renders close button by default when open", () => {
    renderBasic(true)
    const closeBtn = page.getByRole("button", { name: /close/i })
    expect(closeBtn).toBeInTheDocument()
  })

  it("marks title as draggable by default and removes handle when draggable is false", async () => {
    const { rerender } = renderBasic(true)

    const title = (await page.findByText("My Dialog")) as HTMLElement
    expect(title).toBeTruthy()

    // When draggable is enabled (default), the title acts as a handle
    expect(title!.className).toMatch(/draggable-dialog-title/)

    // Get dialog-id from content to confirm the class contains the id as well
    const content = page.getByAttribute("data-slot", "dialog-content") as HTMLElement
    const id = content.getAttribute("data-dialog-id")
    expect(id).toBeTruthy()
    expect(title!.className).toContain(`draggable-dialog-${id}`)

    // Re-render with draggable disabled
    rerender(
      <Dialog open onOpenChange={() => {}} draggable={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    const title2 = document.querySelector('[data-slot="dialog-title"]') as HTMLElement
    expect(title2.className).not.toMatch(/draggable-dialog-title/)
  })

  it("renders resize handle when resizable with size provided", () => {
    render(
      <Dialog
        open
        onOpenChange={() => {}}
        resizable
        size={{
          min: { width: 450, height: 240 },
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resizable</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    const content = page.getByAttribute("data-slot", "dialog-content") as HTMLElement
    const id = content.getAttribute("data-dialog-id")
    expect(id).toBeTruthy()

    // The resize handle's class includes `resize-handle-${dialogId}`
    const handle = document.querySelector(`.resize-handle-${id}`)
    expect(handle).toBeTruthy()
  })
})
