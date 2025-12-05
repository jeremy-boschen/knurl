import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ValidationErrorDisplay } from "./validation-error-display"

describe("ValidationErrorDisplay", () => {
  it("renders issue paths and falls back to Root", () => {
    render(
      <ValidationErrorDisplay
        issues={[
          { message: "Required", path: [], code: "custom" } as any,
          { message: "Invalid email", path: ["user", "email"], code: "custom" } as any,
        ]}
      />,
    )

    expect(screen.getByText(/Root/)).toBeInTheDocument()
    expect(screen.getByText(/Required/)).toBeInTheDocument()
    expect(screen.getByText(/user\.email/)).toBeInTheDocument()
    expect(screen.getByText(/Invalid email/)).toBeInTheDocument()
  })
})
