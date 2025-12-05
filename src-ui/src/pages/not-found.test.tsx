import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import NotFound from "./not-found"

describe("NotFound page", () => {
  it("renders 404 message and helper text", () => {
    render(<NotFound />)
    expect(screen.getByText(/404 Page Not Found/i)).toBeInTheDocument()
    expect(screen.getByText(/Did you forget to add the page/)).toBeInTheDocument()
  })
})
