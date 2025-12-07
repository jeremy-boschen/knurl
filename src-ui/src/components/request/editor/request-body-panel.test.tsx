import { forwardRef, useImperativeHandle } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RequestBodyPanel, getBodyTypeLabel, guessContentTypeByExt } from "./request-body-panel"
import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import { warmPrettier } from "@/lib/prettier"
import { useRequestTab } from "@/state"

const formatMock = vi.fn()
const useRequestBodyMock = vi.fn()
vi.mock("@/lib/prettier", () => ({
  warmPrettier: vi.fn(),
}))

vi.mock("@/components/editor/", () => ({
  CodeEditor: forwardRef(({ value, onChange, ...rest }: any, ref) => {
    useImperativeHandle(ref, () => ({ format: formatMock }))
    return <textarea data-testid={rest["data-test-id"] ?? "code-editor"} value={value} onChange={(event) => onChange(event.target.value)} />
  }),
}))

vi.mock("@/components/ui/knurl", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    FileInput: ({
      onFileChange,
      onContentTypeChange,
      onClear,
      "data-test-id": dataTestId,
    }: any) => (
      <div>
        <button
          type="button"
          data-test-id={dataTestId ?? "mock-file-input"}
          onClick={() => onFileChange("/tmp/demo.txt", "demo.txt", "text/plain")}
        >
          upload
        </button>
        {onContentTypeChange && (
          <button
            type="button"
            data-test-id={`${dataTestId ?? "mock-file-input"}:set-content-type`}
            onClick={() => onContentTypeChange("image/jpeg")}
          >
            set-ct
          </button>
        )}
        {onClear && (
          <button
            type="button"
            data-test-id={`${dataTestId ?? "mock-file-input"}:clear`}
            onClick={() => onClear()}
          >
            clear
          </button>
        )}
      </div>
    ),
  }
})

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generateUniqueId: () => "gen-id",
  }
})

vi.mock("@/state", () => ({
  useRequestBody: (tabId: string) => useRequestBodyMock(tabId),
  useRequestTab: vi.fn(),
}))

const applicationState = {
  requestTabsState: {
    openTabs: {} as Record<string, { merged?: { headers?: Record<string, { id: string; name: string; value: string; enabled: boolean }> } }>,
  },
}

vi.mock("@/state/application", () => ({
  useApplication: (selector?: (state: typeof applicationState) => any) =>
    selector ? selector(applicationState) : applicationState,
}))

const renderPanel = () =>
  render(
    <TooltipProvider>
      <RequestBodyPanel tabId="tab-1" />
    </TooltipProvider>,
  )

describe("RequestBodyPanel", () => {
  it("maps body type labels", () => {
    expect(getBodyTypeLabel({ type: "none" } as any)).toBe("None")
    expect(getBodyTypeLabel({ type: "binary" } as any)).toBe("Binary File")
    expect(getBodyTypeLabel({ type: "form", encoding: "multipart" } as any)).toBe("Form > Multipart")
    expect(getBodyTypeLabel({ type: "form", encoding: "url" } as any)).toBe("Form > URL-Encoded")
    expect(getBodyTypeLabel({ type: "text", language: "json" } as any)).toMatch(/Text > JSON/i)
  })

  it("infers common content types by extension", () => {
    expect(guessContentTypeByExt("report.csv")).toBe("text/csv")
    expect(guessContentTypeByExt("image.PNG")).toBe("image/png")
    expect(guessContentTypeByExt("archive.tgz")).toBe("application/gzip")
    expect(guessContentTypeByExt("unknown.bin")).toBeUndefined()
  })

  it("disables formatting for plain text bodies", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "text", content: "hi", language: "text" },
        original: { type: "text", content: "hi", language: "text" },
      },
      actions,
    })

    renderPanel()

    const formatBtn = getByDataId("request-body-panel:format-button")
    await user.click(formatBtn)
    expect(formatMock).not.toHaveBeenCalled()
    expect(formatBtn).toBeDisabled()
  })

  beforeEach(() => {
    formatMock.mockClear()
    useRequestBodyMock.mockReset()
    applicationState.requestTabsState.openTabs = {}
    vi.mocked(useRequestTab).mockImplementation(() => {
      const tab = applicationState.requestTabsState.openTabs["tab-1"]
      return {
        state: {
          request: tab?.merged ?? { headers: {} },
          activeTab: {},
          original: { headers: {} },
          isDirty: false,
        },
        actions: { requestTabsApi: {} },
      } as any
    })
  })

  it("formats text bodies and updates content", async () => {
    const user = userEvent.setup()
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "text", content: "{}", language: "json" },
        original: { type: "text", content: "{}", language: "json" },
      },
      actions,
    })

    renderPanel()

    await user.click(getByDataId("request-body-panel:format-button"))
    expect(formatMock).toHaveBeenCalled()

    await user.type(screen.getByTestId("request-body-panel:text-editor"), "new")
    expect(actions.updateBodyContent).toHaveBeenCalled()
  })

  it("edits form fields", () => {
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: {
          type: "form",
          encoding: "url",
          formData: {
            f1: { id: "f1", key: "foo", value: "bar", enabled: true, secure: false, kind: "text" },
          },
        },
        original: { type: "form", encoding: "url", formData: { f1: { id: "f1", key: "foo", value: "bar", enabled: true } } },
      },
      actions,
    })

    renderPanel()

    const valueInput = getByDataId("request-body-panel:form-value-input:f1") as HTMLInputElement
    fireEvent.change(valueInput, { target: { value: "baz" } })
    expect(actions.updateFormItem).toHaveBeenCalledWith("f1", { value: "baz" })
  })

  it("updates binary body via drop", () => {
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "binary" },
        original: { type: "binary" },
      },
      actions,
    })

    renderPanel()

    const dropzone = getByDataId("request-body-panel:binary-section")
    fireEvent.drop(dropzone, {
      dataTransfer: {
        getData: () => "file:///tmp/demo.json",
      },
      preventDefault: () => {},
    })

    expect(actions.updateBody).toHaveBeenCalledWith(
      expect.objectContaining({ binaryPath: "/tmp/demo.json", binaryContentType: "application/json" }),
    )
  })

  it("forces multipart encoding and populates file entries on form drop", () => {
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "form", encoding: "url", formData: {} },
        original: { type: "form", encoding: "url", formData: {} },
      },
      actions,
    })

    renderPanel()

    const formZone = getByDataId("request-body-panel:form-section")
    fireEvent.drop(formZone, {
      dataTransfer: {
        getData: () => "file:///tmp/photo.png",
      },
      preventDefault: () => {},
    })

    expect(actions.updateBody).toHaveBeenCalledWith({ encoding: "multipart" })
    expect(actions.updateFormItem).toHaveBeenCalledWith(
      "gen-id",
      expect.objectContaining({
        id: "gen-id",
        key: "photo.png",
        fileName: "photo.png",
        filePath: "/tmp/photo.png",
        contentType: "image/png",
      }),
    )
  })

  it("updates file form item content type when choosing file", () => {
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: {
          type: "form",
          encoding: "multipart",
          formData: { f1: { id: "f1", key: "file", value: "", enabled: true, secure: false, kind: "file" } },
        },
        original: { type: "form", encoding: "multipart", formData: { f1: { id: "f1", key: "file", enabled: true } } },
      },
      actions,
    })

    renderPanel()

    const fileButton = getByDataId("request-body-panel:form-file-input:f1")
    fireEvent.click(fileButton)
    expect(actions.updateFormItem).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({
        fileName: "demo.txt",
        filePath: "/tmp/demo.txt",
        contentType: "text/plain",
      }),
    )
  })

  it("shows form warnings when file fields require multipart encoding", () => {
    applicationState.requestTabsState.openTabs = {
      "tab-1": {
        merged: {
          headers: {
            h1: { id: "h1", name: "Content-Type", value: "application/json", enabled: true },
          },
        },
      },
    }

    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: {
          type: "form",
          encoding: "url",
          formData: {
            f1: { id: "f1", key: "file", value: "", enabled: true, secure: false, kind: "file" },
          },
        },
        original: { type: "form", encoding: "url", formData: {} },
      },
      actions,
    })

    renderPanel()

    const warnings = getByDataId("request-body-panel:warnings")
    expect(warnings.textContent).toContain("Files require multipart")
  })

  it("warns when binary body conflicts with headers", () => {
    applicationState.requestTabsState.openTabs = {
      "tab-1": {
        merged: {
          headers: {
            h1: { id: "h1", name: "Content-Type", value: "multipart/form-data", enabled: true },
          },
        },
      },
    }

    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "binary" },
        original: { type: "binary" },
      },
      actions,
    })

    renderPanel()

    const warnings = getByDataId("request-body-panel:warnings")
    expect(warnings.textContent).toContain("Binary body conflicts")
  })

  it("shows multipart header conflict warning for form bodies", () => {
    applicationState.requestTabsState.openTabs = {
      "tab-1": {
        merged: {
          headers: {
            h1: { id: "h1", name: "Content-Type", value: "application/json", enabled: true },
          },
        },
      },
    }

    const actions = {
      updateBodyContent: vi.fn(),
      updateBody: vi.fn(),
      updateFormItem: vi.fn(),
      removeFormItem: vi.fn(),
      addFormItem: vi.fn(),
      reorderFormItems: vi.fn(),
    }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: {
          type: "form",
          encoding: "multipart",
          formData: {
            f1: { id: "f1", key: "file", value: "", enabled: true, secure: false, kind: "file" },
          },
        },
        original: { type: "form", encoding: "multipart", formData: {} },
      },
      actions,
    })

    renderPanel()

    const warnings = getByDataId("request-body-panel:warnings")
    expect(warnings.textContent).toContain("Content-Type header conflicts")
  })

  it("pre-warms prettier for non-plain text bodies", () => {
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "text", content: "{ }", language: "json" },
        original: { type: "text", content: "{ }", language: "json" },
      },
      actions,
    })

    renderPanel()

    expect(warmPrettier).toHaveBeenCalledWith(["json"])
  })

  it("renders empty state when body type is none", () => {
    const actions = {
      updateBodyContent: vi.fn(),
      updateBody: vi.fn(),
      updateFormItem: vi.fn(),
      removeFormItem: vi.fn(),
      addFormItem: vi.fn(),
      reorderFormItems: vi.fn(),
    }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "none" },
        original: { type: "none" },
      },
      actions,
    })

    renderPanel()

    expect(screen.getByText(/does not have a body/i)).toBeInTheDocument()
  })

  it("shows header conflict warning for text bodies with form content-type", () => {
    applicationState.requestTabsState.openTabs = {
      "tab-1": {
        merged: {
          headers: {
            h1: { id: "h1", name: "Content-Type", value: "multipart/form-data", enabled: true },
          },
        },
      },
    }

    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "text", content: "abc", language: "text" },
        original: { type: "text", content: "abc", language: "text" },
      },
      actions,
    })

    renderPanel()

    const warnings = getByDataId("request-body-panel:warnings")
    expect(warnings.textContent).toContain("Text body conflicts")
  })

  it("drops files into form data and forces multipart with inferred mime", () => {
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "form", encoding: "url", formData: {} },
        original: { type: "form", encoding: "url", formData: {} },
      },
      actions,
    })

    renderPanel()

    const dropzone = getByDataId("request-body-panel:form-section")
    fireEvent.drop(dropzone, {
      dataTransfer: {
        getData: () => "file:///tmp/demo.json\r\nfile:///tmp/image.png",
      },
      preventDefault: () => {},
    })

    expect(actions.updateBody).toHaveBeenCalledWith({ encoding: "multipart" })
    expect(actions.updateFormItem).toHaveBeenCalledTimes(2)
    const firstCall = actions.updateFormItem.mock.calls[0]?.[1]
    expect(firstCall).toMatchObject({
      kind: "file",
      fileName: "demo.json",
      filePath: "/tmp/demo.json",
      contentType: "application/json",
    })
  })

  it("adds form items via add buttons", async () => {
    const user = userEvent.setup()
    const actions = {
      updateBodyContent: vi.fn(),
      updateBody: vi.fn(),
      updateFormItem: vi.fn(),
      removeFormItem: vi.fn(),
      addFormItem: vi.fn(),
      reorderFormItems: vi.fn(),
    }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "form", encoding: "url", formData: {} },
        original: { type: "form", encoding: "url", formData: {} },
      },
      actions,
    })

    renderPanel()

    await user.click(getByDataId("request-body-panel:add-text-field-button"))
    expect(actions.addFormItem).toHaveBeenCalled()

    await user.click(getByDataId("request-body-panel:add-file-field-button"))
    expect(actions.updateBody).toHaveBeenCalledWith({ encoding: "multipart" })
    expect(actions.updateFormItem).toHaveBeenCalledWith(
      "gen-id",
      expect.objectContaining({ id: "gen-id", kind: "file", key: "", value: "", enabled: true, secure: false })
    )
  })

  it("reorders form items through move menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const actions = {
      updateBodyContent: vi.fn(),
      updateBody: vi.fn(),
      updateFormItem: vi.fn(),
      removeFormItem: vi.fn(),
      addFormItem: vi.fn(),
      reorderFormItems: vi.fn(),
    }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: {
          type: "form",
          encoding: "multipart",
          formData: {
            a: { id: "a", key: "one", value: "1", enabled: true, secure: false, kind: "text" },
            b: { id: "b", key: "two", value: "2", enabled: true, secure: false, kind: "text" },
          },
        },
        original: {
          type: "form",
          encoding: "multipart",
          formData: {
            a: { id: "a", key: "one", value: "1", enabled: true },
            b: { id: "b", key: "two", value: "2", enabled: true },
          },
        },
      },
      actions,
    })

    renderPanel()

    const menus = Array.from(document.querySelectorAll('[data-test-id="field-row:menu-button"]')) as HTMLElement[]
    await user.click(menus[0])
    await user.click(getByDataId("field-row:menu-move-down"))
    expect(actions.reorderFormItems).toHaveBeenCalledWith(["b", "a"])

    await user.click(menus[1])
    await user.click(getByDataId("field-row:menu-move-up"))
    expect(actions.reorderFormItems).toHaveBeenCalledWith(["b", "a"])
  })

  it("sets binary content type when dropping a file onto binary section", () => {
    const actions = { updateBodyContent: vi.fn(), updateBody: vi.fn(), updateFormItem: vi.fn(), removeFormItem: vi.fn() }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: { type: "binary", binaryPath: undefined, binaryFileName: undefined },
        original: { type: "binary" },
      },
      actions,
    })

    renderPanel()

    const dropzone = getByDataId("request-body-panel:binary-section")
    fireEvent.drop(dropzone, {
      dataTransfer: {
        getData: () => "file:///tmp/archive.tgz",
      },
      preventDefault: () => {},
    })

    expect(actions.updateBody).toHaveBeenCalledWith(
      expect.objectContaining({ binaryPath: "/tmp/archive.tgz", binaryContentType: "application/gzip" }),
    )
  })

  it("allows clearing and overriding binary body metadata", async () => {
    const user = userEvent.setup()
    const actions = {
      updateBodyContent: vi.fn(),
      updateBody: vi.fn(),
      updateFormItem: vi.fn(),
      removeFormItem: vi.fn(),
      addFormItem: vi.fn(),
      reorderFormItems: vi.fn(),
    }
    useRequestBodyMock.mockReturnValue({
      state: {
        body: {
          type: "binary",
          binaryPath: "/tmp/demo.txt",
          binaryFileName: "demo.txt",
          binaryContentType: "text/plain",
        },
        original: { type: "binary" },
      },
      actions,
    })

    renderPanel()

    await user.click(getByDataId("request-body-panel:binary-file-input:set-content-type"))
    expect(actions.updateBody).toHaveBeenCalledWith({ binaryContentType: "image/jpeg" })

    await user.click(getByDataId("request-body-panel:binary-file-input:clear"))
    expect(actions.updateBody).toHaveBeenCalledWith({
      binaryPath: undefined,
      binaryFileName: undefined,
      binaryContentType: undefined,
    })
  })
})

describe("Request body helpers", () => {
  it("detects content types by file extension", () => {
    expect(guessContentTypeByExt("data.json")).toBe("application/json")
    expect(guessContentTypeByExt("archive.TGZ")).toBe("application/gzip")
    expect(guessContentTypeByExt("image.jpeg")).toBe("image/jpeg")
    expect(guessContentTypeByExt("unknown.bin")).toBeUndefined()
    expect(guessContentTypeByExt(undefined)).toBeUndefined()
  })

  it("builds body type labels for each mode", () => {
    expect(getBodyTypeLabel({ type: "none" } as any)).toBe("None")
    expect(getBodyTypeLabel({ type: "binary" } as any)).toBe("Binary File")
    expect(getBodyTypeLabel({ type: "form", encoding: "multipart" } as any)).toBe("Form > Multipart")
    expect(getBodyTypeLabel({ type: "form", encoding: "url" } as any)).toBe("Form > URL-Encoded")
    expect(getBodyTypeLabel({ type: "text", language: "json" } as any)).toBe("Text > JSON")
    expect(getBodyTypeLabel({ type: "text", language: "custom" as any } as any)).toBe("Text > Plain")
    expect(getBodyTypeLabel({ type: "unknown" } as any)).toBe("Select Body Type")
  })

  it("covers remaining content-type guesses", () => {
    expect(guessContentTypeByExt("readme.txt")).toBe("text/plain")
    expect(guessContentTypeByExt("note.xml")).toBe("application/xml")
    expect(guessContentTypeByExt("config.yaml")).toBe("application/yaml")
    expect(guessContentTypeByExt("styles.css")).toBe("text/css")
    expect(guessContentTypeByExt("script.js")).toBe("application/javascript")
    expect(guessContentTypeByExt("types.ts")).toBe("application/typescript")
    expect(guessContentTypeByExt("vector.svg")).toBe("image/svg+xml")
    expect(guessContentTypeByExt("doc.pdf")).toBe("application/pdf")
    expect(guessContentTypeByExt("bundle.zip")).toBe("application/zip")
    expect(guessContentTypeByExt("archive.tar")).toBe("application/x-tar")
    expect(guessContentTypeByExt("graphic.webp")).toBe("image/webp")
    expect(guessContentTypeByExt("photo.gif")).toBe("image/gif")
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}
