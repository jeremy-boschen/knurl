import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { useState } from "react"

import { FileInput } from "./file-input"
import { openFile } from "@/bindings/knurl"

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn(async () => () => undefined),
  }),
}))

vi.mock("@/bindings/knurl", () => ({
  openFile: vi.fn(),
}))

describe("FileInput", () => {
  const mockedOpenFile = openFile as unknown as vi.Mock

  beforeEach(() => {
    mockedOpenFile.mockReset()
  })

  it("applies the detected mime type when a file is chosen", async () => {
    const user = userEvent.setup()
    mockedOpenFile.mockResolvedValue({
      filePath: "/tmp/example.json",
      content: "",
      mimeType: "application/json",
    })

    const onFileChange = vi.fn()
    const onContentTypeChange = vi.fn()

    render(
      <FileInput
        fileName=""
        contentType=""
        onFileChange={onFileChange}
        onContentTypeChange={onContentTypeChange}
        onClear={vi.fn()}
      />,
    )

    const chooseButton = screen.getByTitle("Choose file")
    await user.click(chooseButton)

    expect(mockedOpenFile).toHaveBeenCalledWith({ title: "Choose File", readContent: false })
    expect(onFileChange).toHaveBeenCalledWith("/tmp/example.json", "example.json", "application/json")
    expect(onContentTypeChange).toHaveBeenCalledWith("application/json")
  })

  it("leaves callbacks untouched when user cancels the dialog", async () => {
    const user = userEvent.setup()
    mockedOpenFile.mockResolvedValue(null)

    const onFileChange = vi.fn()
    const onContentTypeChange = vi.fn()

    render(
      <FileInput
        fileName=""
        contentType=""
        onFileChange={onFileChange}
        onContentTypeChange={onContentTypeChange}
        onClear={vi.fn()}
      />,
    )

    const chooseButton = screen.getByTitle("Choose file")
    await user.click(chooseButton)

    expect(onFileChange).not.toHaveBeenCalled()
    expect(onContentTypeChange).not.toHaveBeenCalled()
  })

  it("clears the selected file when the clear button is pressed", async () => {
    const user = userEvent.setup()
    const onFileChange = vi.fn()
    const onContentTypeChange = vi.fn()
    const onClear = vi.fn()

    render(
      <FileInput
        fileName="payload.bin"
        contentType="application/octet-stream"
        onFileChange={onFileChange}
        onContentTypeChange={onContentTypeChange}
        onClear={onClear}
      />,
    )

    const clearButton = screen.getByLabelText("Clear file")
    await user.click(clearButton)

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onContentTypeChange).toHaveBeenLastCalledWith("")
  })

  it("lets users manually edit the content type", async () => {
    const user = userEvent.setup()
    mockedOpenFile.mockResolvedValue({
      filePath: "",
      content: "",
      mimeType: "",
    })

    const onFileChange = vi.fn()
    const onContentTypeChange = vi.fn()

    function Wrapper() {
      const [currentContentType, setCurrentContentType] = useState("application/octet-stream")
      return (
        <FileInput
          fileName="payload.bin"
          contentType={currentContentType}
          onFileChange={onFileChange}
          onContentTypeChange={(value) => {
            setCurrentContentType(value)
            onContentTypeChange(value)
          }}
          onClear={() => {
            setCurrentContentType("")
            onContentTypeChange("")
          }}
        />
      )
    }

    render(<Wrapper />)

    const contentTypeInput = screen.getByPlaceholderText("content-type")
    await user.clear(contentTypeInput)
    await user.type(contentTypeInput, "text/plain")

    expect(onContentTypeChange).toHaveBeenLastCalledWith("text/plain")
  })
})
