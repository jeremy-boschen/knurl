import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import NotFound from "./not-found"

describe("NotFound page", () => {
  it("renders 404 content", () => {
    render(<NotFound />)
    expect(screen.getByText(/404 page not found/i)).toBeInTheDocument()
    expect(screen.getByText(/Did you forget to add the page to the router/i)).toBeInTheDocument()
  })
})
