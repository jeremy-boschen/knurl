import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HttpBadge } from "./http-badge"

// Minimal focused tests to verify rendering and class merging behavior

describe("HttpBadge", () => {
  it("renders correct abbreviation for common HTTP methods", () => {
    const { rerender } = render(<HttpBadge method="GET" />)
    expect(screen.getByText("GET")).toBeInTheDocument()

    rerender(<HttpBadge method="DELETE" />)
    expect(screen.getByText("DEL")).toBeInTheDocument()

    rerender(<HttpBadge method="OPTIONS" />)
    expect(screen.getByText("OPT")).toBeInTheDocument()

    rerender(<HttpBadge method="TRACE" />)
    expect(screen.getByText("TRACE")).toBeInTheDocument()
  })

  it("applies color classes and merges custom className", () => {
    render(<HttpBadge method="POST" className="extra-class" data-testid="badge" />)

    const badge = screen.getByTestId("badge")
    // Color classes for POST defined in a component
    expect(badge).toHaveClass("bg-http-post")
    expect(badge).toHaveClass("text-http-post-foreground")
    // Custom className should be merged
    expect(badge).toHaveClass("extra-class")
  })
})
