import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FileInput } from "./file-input"

const dragListener = vi.hoisted(() => ({ handler: null as null | ((event: any) => void) }))

vi.mock("@/bindings/knurl", () => ({
  openFile: vi.fn(),
}))
import { openFile } from "@/bindings/knurl"

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn(async (cb: (event: any) => void) => {
      dragListener.handler = cb
      return vi.fn()
    }),
  }),
}))

describe("FileInput", () => {
  const baseProps = {
    fileName: "",
    contentType: "",
    onFileChange: vi.fn(),
    onContentTypeChange: vi.fn(),
    onClear: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).__TAURI__ = {}
    dragListener.handler = null
  })

  const renderInput = (props = {}) =>
    render(
      <FileInput
        {...baseProps}
        {...props}
      />,
    )

  it("chooses a file via dialog and syncs mime type", async () => {
    vi.mocked(openFile).mockResolvedValue({ filePath: "/tmp/data.json", mimeType: "application/json" })
    renderInput()

    await userEvent.click(screen.getByLabelText(/choose file/i))

    await waitFor(() => expect(openFile).toHaveBeenCalled())
    expect(baseProps.onFileChange).toHaveBeenCalledWith("/tmp/data.json", "data.json", "application/json")
    expect(baseProps.onContentTypeChange).toHaveBeenCalledWith("application/json")

    fireEvent.change(screen.getByPlaceholderText("content-type"), { target: { value: "text/plain" } })
    expect(baseProps.onContentTypeChange).toHaveBeenCalledWith("text/plain")
  })

  it("handles drag-and-drop from tauri events and DOM uri drops", async () => {
    const first = renderInput()
    const dropzone = document.querySelector("fieldset") as HTMLFieldSetElement
    vi.spyOn(dropzone, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 } as DOMRect)

    dragListener.handler?.({
      payload: {
        type: "drop",
        paths: ["/Users/me/file.md"],
        position: { x: 20, y: 20 },
      },
    })

    expect(baseProps.onFileChange).toHaveBeenCalledWith("/Users/me/file.md", "file.md")

    first.unmount()
    delete (window as any).__TAURI__
    renderInput()
    const refreshedZone = document.querySelector("fieldset") as HTMLFieldSetElement
    const dataTransfer = {
      getData: vi.fn(() => "file:///C:/Temp/demo.txt\n"),
    }
    fireEvent.drop(refreshedZone, { dataTransfer })
    expect(baseProps.onFileChange).toHaveBeenLastCalledWith("C:/Temp/demo.txt", "demo.txt")
  })

  it("clears selection and ignores dragover", async () => {
    renderInput({ fileName: "foo.txt" })

    const clearBtn = screen.getByLabelText(/clear file/i)
    expect(clearBtn).not.toBeDisabled()
    await userEvent.click(clearBtn)
    expect(baseProps.onClear).toHaveBeenCalled()
    expect(baseProps.onContentTypeChange).toHaveBeenCalledWith("")

    const dropzone = document.querySelector("fieldset") as HTMLFieldSetElement
    fireEvent.dragOver(dropzone, { dataTransfer: {} })
    expect(baseProps.onFileChange).toHaveBeenCalledTimes(0)
  })
})
