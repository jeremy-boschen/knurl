import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock Sheet primitives to avoid Radix Dialog context requirements
vi.mock("@/components/ui/sheet", () => ({
  __esModule: true,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

// Mock child components
vi.mock("@/components/utility-sheets/environment-manager", () => ({
  __esModule: true,
  default: () => <div data-testid="environment-manager">Environment Manager</div>,
}))

// Mock state hooks
vi.mock("@/state", () => ({
  useCollection: vi.fn(() => ({
    collection: { id: "col1", name: "Test Collection", environments: {} },
    collectionsApi: {},
  })),
}))

// Import the component under test AFTER mocks
import CollectionSettingsSheet from "."

describe("CollectionSettingsSheet", () => {
  it("renders the sheet header with title and description", () => {
    render(<CollectionSettingsSheet collectionId="col1" selectedEnvironmentId={undefined} />)
    expect(screen.getByText("Collection Settings")).toBeInTheDocument()
    expect(screen.getByText(/Manage .* for .*Test Collection/i)).toBeInTheDocument()
  })

  it("renders tabs for Environments and Authentication", () => {
    render(<CollectionSettingsSheet collectionId="col1" selectedEnvironmentId={undefined} />)
    expect(screen.getByRole("button", { name: /Environments/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Authentication/i })).toBeInTheDocument()
  })

  it("renders the EnvironmentManager component in the Environments tab", () => {
    render(<CollectionSettingsSheet collectionId="col1" selectedEnvironmentId={undefined} />)
    expect(screen.getByTestId("environment-manager")).toBeInTheDocument()
  })
})
