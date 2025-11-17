import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ValidationErrorDisplay } from "./validation-error-display"

describe("ValidationErrorDisplay", () => {
  it("lists issues with their paths", () => {
    render(
      <ValidationErrorDisplay
        issues={[
          { path: ["collection", "name"], message: "Name missing" } as any,
          { path: [], message: "Root error" } as any,
        ]}
      />,
    )

    expect(screen.getByText(/collection.name/i)).toBeInTheDocument()
    expect(screen.getByText(/Name missing/)).toBeInTheDocument()
    expect(screen.getByText(/Root error/)).toBeInTheDocument()
  })
})
