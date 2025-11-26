import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ValidationErrorDisplay } from "./validation-error-display"

describe("ValidationErrorDisplay", () => {
  it("renders each issue with path and message", () => {
    render(
      <ValidationErrorDisplay
        issues={[
          { path: ["request", "url"], message: "Invalid URL" } as any,
          { path: [], message: "Root error" } as any,
        ]}
      />,
    )

    expect(screen.getByText("Validation Errors")).toBeInTheDocument()
    expect(screen.getByText("request.url")).toBeInTheDocument()
    expect(screen.getByText(/Invalid URL/)).toBeInTheDocument()
    expect(screen.getByText("Root")).toBeInTheDocument()
    expect(screen.getByText(/Root error/)).toBeInTheDocument()
  })
})
