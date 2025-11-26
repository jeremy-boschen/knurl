import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import RenameDialog from "./rename-dialog"

describe("RenameDialog", () => {
  it("renders title and description when open", () => {
    render(
      <RenameDialog
        open
        title="Rename Request"
        description="Provide a new name"
        name="Old name"
        context={{}}
        onRename={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByText("Rename Request")).toBeInTheDocument()
    expect(screen.getByText("Provide a new name")).toBeInTheDocument()
  })

  it("submits new name and then calls onCancel", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()
    const ctx = { from: "test" }

    render(
      <RenameDialog
        open
        title="Rename"
        description="desc"
        name="Old"
        placeholder="Type new name"
        context={ctx}
        onRename={onRename}
        onCancel={onCancel}
      />,
    )

    const input = screen.getByPlaceholderText("Type new name") as HTMLInputElement
    expect(input.value).toBe("Old")

    await user.clear(input)
    await user.type(input, "New Name")

    const submit = screen.getByRole("button", { name: /rename/i })
    await user.click(submit)

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("New Name", ctx)
      expect(onCancel).toHaveBeenCalledWith(ctx)
    })
  })

  it("clicking Cancel triggers onCancel and not onRename", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onCancel = vi.fn()
    const ctx = { cancel: true }

    render(
      <RenameDialog
        open
        title="Rename"
        description="desc"
        name="Item"
        context={ctx}
        onRename={onRename}
        onCancel={onCancel}
      />,
    )

    const cancelBtn = screen.getByRole("button", { name: /cancel/i })
    await user.click(cancelBtn)

    expect(onCancel).toHaveBeenCalledWith(ctx)
    expect(onRename).not.toHaveBeenCalled()
  })
})
