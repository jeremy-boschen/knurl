import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EmptyState } from "./empty-state"

describe("EmptyState", () => {
  it("renders message with default height classes", () => {
    const { container } = render(<EmptyState message="Nothing here" />)
    const el = container.querySelector('[data-test-id="empty-state"]')
    expect(el?.textContent).toContain("Nothing here")
    expect(el?.className).toMatch(/h-\[2\.25rem]/)
    expect(el?.className).toMatch(/flex/)
  })

  it("applies tall spacing when height is tall", () => {
    const { rerender, container } = render(<EmptyState message="Tall" height="tall" />)
    let el = container.querySelector('[data-test-id="empty-state"]')
    expect(el?.className).toMatch(/py-8/)
    rerender(<EmptyState message="Default" />)
    el = container.querySelector('[data-test-id="empty-state"]')
    expect(el?.className).not.toMatch(/py-8/)
  })
})
