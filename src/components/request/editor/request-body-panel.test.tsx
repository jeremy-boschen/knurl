import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { openFile } from "@/bindings/knurl"
import { RequestBodyPanel } from "./request-body-panel"
import { TooltipProvider } from "@/components/ui/knurl/tooltip"

vi.mock("@/bindings/knurl", () => ({
  openFile: vi.fn(),
}))

// Mock state hooks
vi.mock("@/state", () => ({
  useRequestBody: vi.fn(),
  useApplication: vi.fn(),
}))

import { useRequestBody, useApplication } from "@/state"

describe("RequestBodyPanel", () => {
  const tabId = "tab-1"

  const baseBody = { type: "none" } as any
  const baseOriginal = { type: "none" } as any
  const actions = {
    updateBodyContent: vi.fn(),
    updateRequestPatch: vi.fn(),
    updateFormItem: vi.fn(),
    removeFormItem: vi.fn(),
    addFormItem: vi.fn(),
    formatContent: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApplication).mockImplementation((selector?: any) => {
      const base: any = {
        requestTabsState: { openTabs: { [tabId]: { merged: { headers: {} } } } },
      }
      return typeof selector === "function" ? selector(base) : base
    })
  })

  it("shows current body type label without inline menu", () => {
    vi.mocked(useRequestBody).mockReturnValue({
      state: { body: baseBody, original: baseOriginal },
      actions,
    } as any)

    render(
      <TooltipProvider>
        <RequestBodyPanel tabId={tabId} />
      </TooltipProvider>,
    )

    expect(screen.getByText(/^none$/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^none$/i })).not.toBeInTheDocument()
  })

  it("attaches binary file and infers content-type when missing", async () => {
    vi.mocked(useRequestBody).mockReturnValue({
      state: { body: { type: "binary", binaryContentType: undefined }, original: { type: "binary" } },
      actions,
    } as any)

    vi.mocked(openFile).mockResolvedValue({ filePath: "/tmp/data.json" } as any)

    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <RequestBodyPanel tabId={tabId} />
      </TooltipProvider>,
    )

    const choose = screen.getByRole("button", { name: /choose file/i })
    await user.click(choose)

    expect(openFile).toHaveBeenCalled()
    expect(actions.updateRequestPatch).toHaveBeenCalledWith({
      body: { binaryPath: "/tmp/data.json", binaryFileName: "data.json", binaryContentType: "application/json" },
    })
  })

  it("multipart: does not render a type toggle for existing fields", () => {
    const formId = "f1"
    vi.mocked(useRequestBody).mockReturnValue({
      state: {
        body: {
          type: "form",
          encoding: "multipart",
          formData: { [formId]: { id: formId, key: "k", value: "v", enabled: true, secure: false, kind: "text" } },
        },
        original: {
          type: "form",
          encoding: "multipart",
          formData: { [formId]: { id: formId, key: "k", value: "v", enabled: true, secure: false, kind: "text" } },
        },
      },
      actions,
    } as any)

    render(
      <TooltipProvider>
        <RequestBodyPanel tabId={tabId} />
      </TooltipProvider>,
    )

    expect(screen.queryByRole("button", { name: /text/i })).not.toBeInTheDocument()
  })

  it("binary: handles file drop via file:// URI list", async () => {
    vi.mocked(useRequestBody).mockReturnValue({
      state: { body: { type: "binary" }, original: { type: "binary" } },
      actions,
    } as any)

    render(
      <TooltipProvider>
        <RequestBodyPanel tabId={tabId} />
      </TooltipProvider>,
    )

    const dropzone = screen.getByRole("region", { name: /binary body dropzone/i })
    const data = { getData: (t: string) => (t === "text/uri-list" ? "file:///tmp/sample.json" : "") }
    const evt = new Event("drop", { bubbles: true }) as any
    evt.dataTransfer = data
    dropzone.dispatchEvent(evt)
    expect(actions.updateRequestPatch).toHaveBeenCalledWith({
      body: {
        binaryPath: "/tmp/sample.json",
        binaryFileName: "sample.json",
        binaryContentType: "application/json",
      },
    })
  })

  // Warnings are covered via engine tests; UI-only warning rendering is implicitly exercised above
})
