import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/dropdown-menu", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/dropdown-menu")>("@/components/ui/dropdown-menu")
  return {
    ...actual,
    DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSubTrigger: ({ children, ...props }: React.ComponentProps<"button">) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { RequestMenuMoveTarget } from "./request-menu"
import { RequestMenuContent } from "./request-menu"

const renderMenu = (props: Partial<Parameters<typeof RequestMenuContent>[0]> = {}, onAction = vi.fn()) => {
  const moveTargets: RequestMenuMoveTarget[] = props.moveTargets ?? [
    { id: "folder-a", path: "Root / Folder A" },
  ]

  render(
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <button type="button">Open</button>
      </DropdownMenuTrigger>
      <RequestMenuContent
        collectionId="col-1"
        requestId="req-1"
        requestName="Fetch"
        isScratch={false}
        moveTargets={moveTargets}
        onAction={onAction}
        {...props}
      />
    </DropdownMenu>
  )

  return onAction
}

describe("RequestMenuContent", () => {
  it("dispatches payloads for rename/duplicate/move/copy/delete", async () => {
    const user = userEvent.setup()
    const onAction = renderMenu()

    await user.click(screen.getByText("Rename"))
    expect(onAction).toHaveBeenNthCalledWith(1, {
      actionId: "rename",
      kind: "request",
      collectionId: "col-1",
      requestId: "req-1",
      name: "Fetch",
    })

    await user.click(screen.getByText("Duplicate"))
    expect(onAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ actionId: "duplicate" }))

    await user.hover(screen.getByText("Move to Folder"))
    await user.click(await screen.findByText("Root / Folder A"))
    expect(onAction).toHaveBeenCalledWith({
      actionId: "request:move",
      kind: "request",
      collectionId: "col-1",
      requestId: "req-1",
      name: "Fetch",
      targetFolderId: "folder-a",
    })

    await user.click(screen.getByText("Copy as JSON"))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ actionId: "copy" }))

    await user.click(screen.getByText("Delete"))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ actionId: "delete" }))

    expect(onAction).toHaveBeenCalledTimes(5)
  })

  it("only renders copy/delete for scratch requests", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <RequestMenuContent
          collectionId="col-1"
          requestId="req-1"
          requestName="Scratch"
          isScratch
          onAction={onAction}
        />
      </DropdownMenu>
    )

    expect(screen.queryByText("Rename")).not.toBeInTheDocument()
    expect(screen.queryByText("Duplicate")).not.toBeInTheDocument()
    expect(screen.queryByText("Move to Folder")).not.toBeInTheDocument()

    await user.click(screen.getByText("Copy as JSON"))
    await user.click(screen.getByText("Delete"))

    expect(onAction).toHaveBeenCalledTimes(2)
    expect(onAction).toHaveBeenNthCalledWith(1, expect.objectContaining({ actionId: "copy" }))
    expect(onAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ actionId: "delete" }))
  })
})
