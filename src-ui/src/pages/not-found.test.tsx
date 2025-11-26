import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock(
  "@/components/ui/card",
  () => ({
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  }),
  { virtual: true },
)

import NotFound from "./not-found"

describe("NotFound page", () => {
  it("shows 404 messaging and guidance", () => {
    render(<NotFound />)
    expect(screen.getByText("404 Page Not Found")).toBeInTheDocument()
    expect(screen.getByText(/Did you forget to add the page to the router/)).toBeInTheDocument()
  })
})
