import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock Sheet primitives to avoid Radix Dialog context requirements
vi.mock("@/components/ui/sheet", () => ({
  __esModule: true,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

// Mock child components
const environmentManagerMock = vi.fn()
vi.mock("@/components/utility-sheets/environment-manager", () => ({
  __esModule: true,
  default: (props: any) => {
    environmentManagerMock(props)
    return <div data-testid="environment-manager">Environment Manager</div>
  },
}))

const collectionAuthPanelMock = vi.fn()
vi.mock("./collection-auth-panel", () => ({
  __esModule: true,
  default: (props: any) => {
    collectionAuthPanelMock(props)
    return <div data-testid="collection-auth-panel">Auth Panel</div>
  },
}))

// Mock state hooks
vi.mock("@/state", () => ({
  useCollection: vi.fn(() => ({
    state: { collection: { id: "col1", name: "Test Collection", environments: {} } },
    actions: {},
  })),
}))

// Import the component under test AFTER mocks
import CollectionSettingsSheet from "."

beforeEach(() => {
  environmentManagerMock.mockClear()
  collectionAuthPanelMock.mockClear()
})

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

  it("passes collectionId and selectedEnvironmentId to EnvironmentManager", () => {
    render(<CollectionSettingsSheet collectionId="col-99" selectedEnvironmentId="env-7" />)
    expect(environmentManagerMock).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: "col-99", selectedEnvironmentId: "env-7" }),
    )
  })

  it("switches to the authentication tab when requested", async () => {
    const user = userEvent.setup()
    render(<CollectionSettingsSheet collectionId="col1" selectedEnvironmentId={undefined} />)

    await user.click(screen.getByRole("button", { name: /Authentication/i }))

    expect(collectionAuthPanelMock).toHaveBeenCalledWith(expect.objectContaining({ collectionId: "col1" }))
    expect(screen.getByTestId("collection-auth-panel")).toBeInTheDocument()
    expect(screen.queryByTestId("environment-manager")).not.toBeInTheDocument()
  })

  it("respects the initial tab prop", () => {
    render(<CollectionSettingsSheet collectionId="col1" selectedEnvironmentId={undefined} tab="authentication" />)
    expect(collectionAuthPanelMock).toHaveBeenCalled()
    expect(screen.getByTestId("collection-auth-panel")).toBeInTheDocument()
    expect(screen.queryByTestId("environment-manager")).not.toBeInTheDocument()
  })
})
