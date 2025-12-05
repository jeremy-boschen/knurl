import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ValidationErrorDisplay } from "./validation-error-display"

describe("ValidationErrorDisplay", () => {
  it("renders list of issues with paths and messages", () => {
    render(
      <ValidationErrorDisplay
        issues={[
          { path: ["root"], message: "Missing name" } as any,
          { path: ["items", "0", "id"], message: "Required" } as any,
        ]}
      />,
    )

    expect(screen.getByText(/Validation Errors/i)).toBeInTheDocument()
    expect(screen.getByText(/root/i)).toBeInTheDocument()
    expect(screen.getByText(/items\.0\.id/i)).toBeInTheDocument()
    expect(screen.getByText(/Required/i)).toBeInTheDocument()
  })
})
