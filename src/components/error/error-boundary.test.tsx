import {render, screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
import ErrorBoundary from "./error-boundary"

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: toastMock,
}))

let shouldThrow = true
const ThrowingChild = () => {
  if (shouldThrow) {
    throw new Error("boom")
  }
  return <div data-testid="safe-child">Rendered</div>
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    toastMock.error.mockClear()
    shouldThrow = true
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders default fallback and recovers on retry", async () => {
    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    const fallbackHeading = await screen.findByRole("heading", {name: /something went wrong/i})
    expect(fallbackHeading).toBeInTheDocument()
    expect(toastMock.error).toHaveBeenCalled()

    shouldThrow = false
    await user.click(screen.getByRole("button", {name: /try again/i}))
    expect(await screen.findByTestId("safe-child")).toBeInTheDocument()
  })

  it("supports functional fallbacks", async () => {
    shouldThrow = true
    render(
      <ErrorBoundary fallback={(error) => <div data-testid="custom-fallback">{error.message}</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    const fallback = await screen.findByTestId("custom-fallback")
    expect(fallback).toHaveTextContent("boom")
  })
})
