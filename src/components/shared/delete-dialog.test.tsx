import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import DeleteDialog from "./delete-dialog"

describe("DeleteDialog", () => {
  it("calls onDelete and onCancel when confirming", async () => {
    const onDelete = vi.fn(async () => {})
    const onCancel = vi.fn()

    render(
      <DeleteDialog
        open
        title="Remove request"
        description="Are you sure?"
        context={{ id: "context-id" }}
        onDelete={onDelete}
        onCancel={onCancel}
      />,
    )

    const user = userEvent.setup()
    const confirmButton = await screen.findByRole("button", { name: "Yes" })
    await user.click(confirmButton)

    expect(onDelete).toHaveBeenCalledWith({ id: "context-id" })
    expect(onCancel).toHaveBeenCalledWith({ id: "context-id" })
    expect(onDelete).toHaveBeenCalledTimes(1)

    const deleteCall = onDelete.mock.invocationCallOrder[0]
    const cancelCalls = onCancel.mock.invocationCallOrder
    const lastCancelCall = cancelCalls[cancelCalls.length - 1]
    expect(lastCancelCall).toBeGreaterThan(deleteCall)
  })

  it("only calls onCancel when dismissed", async () => {
    const onDelete = vi.fn()
    const onCancel = vi.fn()

    render(
      <DeleteDialog
        open
        title="Remove request"
        description="Are you sure?"
        context="ctx"
        onDelete={onDelete}
        onCancel={onCancel}
      />,
    )

    const user = userEvent.setup()
    const cancelButton = await screen.findByRole("button", { name: "No" })
    await user.click(cancelButton)

    expect(onDelete).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledWith("ctx")
  })
})
