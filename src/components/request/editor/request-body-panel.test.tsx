import { forwardRef, useImperativeHandle } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RequestBodyPanel } from "./request-body-panel"
import { TooltipProvider } from "@/components/ui/knurl/tooltip"

const formatMock = vi.fn()
const useRequestBodyMock = vi.fn()

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

vi.mock("@/state/application", () => ({
  useApplication: (selector?: (state: any) => any) =>
    selector ? selector({ requestTabsState: { openTabs: {} } }) : { requestTabsState: { openTabs: {} } },
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
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}
