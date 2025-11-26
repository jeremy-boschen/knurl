import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SectionHeader } from "./section-header"

describe("SectionHeader", () => {
  it("renders title and optional children", () => {
    const { container } = render(
      <SectionHeader title="Params">
        <span data-testid="child">child</span>
      </SectionHeader>,
    )
    const header = container.querySelector('[data-test-id="section-header"]')
    expect(header).toBeInTheDocument()
    expect(screen.getByText("Params")).toBeInTheDocument()
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("renders actions only when provided", () => {
    const { rerender } = render(<SectionHeader title="Headers" />)
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull()

    rerender(<SectionHeader title="Headers" actions={<button>Add</button>} />)
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument()
  })
})
