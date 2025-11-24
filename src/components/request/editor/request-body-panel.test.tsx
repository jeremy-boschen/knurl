import { forwardRef, useImperativeHandle } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RequestBodyPanel, getBodyTypeLabel, guessContentTypeByExt } from "./request-body-panel"
import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import { warmPrettier } from "@/lib/prettier"

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
    FileInput: ({ onFileChange, "data-test-id": dataTestId }: any) => (
      <button
        type="button"
        data-testid={dataTestId ?? "mock-file-input"}
        onClick={() => onFileChange("/tmp/demo.txt", "demo.txt", "text/plain")}
      >
        upload
      </button>
    ),
  }
})

vi.mock("@/state", () => ({
  useRequestBody: (tabId: string) => useRequestBodyMock(tabId),
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
  beforeEach(() => {
    formatMock.mockClear()
    useRequestBodyMock.mockReset()
    applicationState.requestTabsState.openTabs = {}
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

    expect(actions.updateBody).toHaveBeenCalledWith(expect.objectContaining({ binaryPath: "/tmp/demo.json" }))
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
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}
