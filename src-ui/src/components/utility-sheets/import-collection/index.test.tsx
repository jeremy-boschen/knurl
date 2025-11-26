import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import ImportCollectionSheet from "./index"

const parserMock = vi.hoisted(() => ({
  useImportParser: vi.fn(),
}))

const selectionMock = vi.hoisted(() => ({
  useSelectionManager: vi.fn(),
}))

const actionsMock = vi.hoisted(() => ({
  useImportActions: vi.fn(),
}))

const collectionsHook = vi.hoisted(() => ({
  useCollections: vi.fn(),
}))

vi.mock("./use-import-parser", () => parserMock)
vi.mock("./use-selection-manager", () => selectionMock)
vi.mock("./use-import-actions", () => actionsMock)
vi.mock("@/state", () => collectionsHook)

vi.mock("./components/import-source-step", () => ({
  ImportSourceStep: (props: any) => (
    <div>
      <button data-test-id="mock-import-source:choose" onClick={props.onChooseFile}>
        choose
      </button>
      <button data-test-id="mock-import-source:paste" onClick={props.onPaste}>
        paste
      </button>
    </div>
  ),
}))

vi.mock("./components/import-preview-step", () => ({
  ImportPreviewStep: () => <div data-testid="mock-preview-step" />,
}))

vi.mock("./components/validation-error-display", () => ({
  ValidationErrorDisplay: ({ issues }: { issues: any[] }) => (
    <div data-testid="mock-validation">{issues.length} issues</div>
  ),
}))

const codeEditorState = { values: [] as string[] }
vi.mock("@/components/editor/code-editor", () => ({
  CodeEditor: ({ value, onChange, language }: { value: string; onChange: (next: string) => void; language?: string }) => {
    codeEditorState.values.push(value)
    return <textarea data-testid={`code-editor:${language ?? "text"}`} value={value} onChange={(event) => onChange(event.target.value)} />
  },
}))

vi.mock("@/components/ui/sheet", () => ({
  SheetHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const openFile = vi.fn()
vi.mock("@/bindings/knurl", () => ({
  openFile: (...args: unknown[]) => openFile(...args),
}))

const originalNavigator = window.navigator
let clipboardSpy: ReturnType<typeof vi.fn>

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}

describe("ImportCollectionSheet", () => {
  const handleImport = vi.fn()
  const handleMerge = vi.fn()
  const handleOverwrite = vi.fn()
  const setStatus = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    codeEditorState.values = []
    parserMock.useImportParser.mockReturnValue({
      collection: { collection: { name: "Sample Collection" } },
      issues: null,
      detectedFormat: null,
      convertedData: "{}",
    })
    selectionMock.useSelectionManager.mockReturnValue({
      requests: [
        { id: "req-1", name: "List", method: "GET", url: "https://api" },
      ],
      environments: [],
      selectedRequests: new Set(["req-1"]),
      selectedEnvironments: new Set(),
      reqMasterState: true,
      envMasterState: false,
      toggleRequestSelection: vi.fn(),
      toggleAllRequests: vi.fn(),
      toggleEnvironmentSelection: vi.fn(),
      toggleAllEnvironments: vi.fn(),
    })
    actionsMock.useImportActions.mockReturnValue({
      status: null,
      setStatus,
      handleImport,
      handleOverwrite,
      handleMerge,
    })
    collectionsHook.useCollections.mockReturnValue({ state: { collectionsIndex: [] } })
    openFile.mockResolvedValue({ content: "{}" })
    clipboardSpy = vi.fn().mockResolvedValue("pasted data")
    const navigatorStub = {
      clipboard: {
        readText: clipboardSpy,
      },
    }
    Object.defineProperty(window, "navigator", {
      value: navigatorStub,
      configurable: true,
    })
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorStub,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "navigator", {
      value: originalNavigator,
      configurable: true,
    })
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    })
  })

  it("submits import when requirements satisfied", async () => {
    const user = userEvent.setup()
    render(<ImportCollectionSheet />)
    await screen.findByDisplayValue("Sample Collection")
    await user.click(screen.getByRole("button", { name: /^Import$/i }))
    expect(handleImport).toHaveBeenCalledWith("Sample Collection")
  })

  it("shows conflict controls and supports merge", async () => {
    collectionsHook.useCollections.mockReturnValue({ state: { collectionsIndex: [{ name: "Sample Collection" }] } })
    const user = userEvent.setup()
    render(<ImportCollectionSheet />)
    await screen.findByRole("button", { name: /Merge/i })
    await user.click(screen.getByRole("button", { name: /Merge/i }))
    expect(handleMerge).toHaveBeenCalledWith("Sample Collection")
    await user.click(screen.getByRole("button", { name: /Replace/i }))
    expect(handleOverwrite).toHaveBeenCalledWith("Sample Collection")
  })

  it("handles file selection errors and clipboard pastes", async () => {
    const user = userEvent.setup()
    openFile.mockRejectedValue(new Error("boom"))
    render(<ImportCollectionSheet />)

    await user.click(getByDataId("mock-import-source:choose"))
    expect(openFile).toHaveBeenCalled()
    expect(setStatus).toHaveBeenCalledWith({ kind: "error", message: "boom" })

    await user.click(getByDataId("mock-import-source:paste"))
    expect(setStatus).toHaveBeenCalledWith(null)
  })
})
