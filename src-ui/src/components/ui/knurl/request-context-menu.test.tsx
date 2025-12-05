import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { writeText } from "@tauri-apps/plugin-clipboard-manager"
vi.mock("@/components/ui/context-menu", () => {
  const React = require("react")
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const Item = ({
    children,
    onClick,
    ...props
  }: React.PropsWithChildren<{ onClick?: () => void } & Record<string, unknown>>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  )
  return {
    ContextMenu: Container,
    ContextMenuTrigger: Container,
    ContextMenuContent: Container,
    ContextMenuItem: Item,
    ContextMenuSeparator: () => <div role="separator" />,
    ContextMenuSub: Container,
    ContextMenuSubTrigger: Item,
    ContextMenuSubContent: Container,
  }
})

import { ContextMenu } from "@/components/ui/context-menu"
import { RequestContextMenuContent } from "./request-context-menu"

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(() => Promise.resolve()),
}))

const collectionsApi = {
  duplicateRequest: vi.fn(),
  getRequest: vi.fn(),
}

vi.mock("@/state", () => ({
  collectionsApi: () => collectionsApi,
  ScratchCollectionId: "scratch",
}))

describe("RequestContextMenuContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("handles rename, duplicate, copy, and delete actions", async () => {
    const user = userEvent.setup()
    collectionsApi.getRequest.mockReturnValue({ id: "r1", name: "Req", value: 1 })

    const onRename = vi.fn()
    const onDelete = vi.fn()

    render(
      <ContextMenu open onOpenChange={() => {}}>
        <RequestContextMenuContent
          collectionId="c1"
          requestId="r1"
          requestName="Req"
          onRename={onRename}
          onDelete={onDelete}
        />
      </ContextMenu>,
    )
    await user.click(screen.getByText(/rename/i))
    expect(onRename).toHaveBeenCalled()

    await user.click(screen.getByText(/duplicate/i))
    expect(collectionsApi.duplicateRequest).toHaveBeenCalledWith("c1", "r1")

    await user.click(screen.getByText(/copy as json/i))
    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ id: "r1", name: "Req", value: 1 }, null, 2))

    await user.click(screen.getByText(/delete/i))
    expect(onDelete).toHaveBeenCalled()
  })

  it("hides move submenu for scratch collections", () => {
    const { container } = render(
      <ContextMenu open onOpenChange={() => {}}>
        <RequestContextMenuContent
          collectionId="scratch"
          requestId="r1"
          requestName="Req"
          moveTargets={[{ id: "f", path: "Folder" }]}
        />
      </ContextMenu>,
    )
    expect(container.querySelector("[data-target-folder-id]")).toBeNull()
  })
})
