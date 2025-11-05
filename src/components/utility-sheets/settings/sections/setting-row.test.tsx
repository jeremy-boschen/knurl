import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { SettingRow, FieldHelp } from "./setting-row"

describe("SettingRow", () => {
  it("renders label, description, and children", () => {
    render(
      <SettingRow label="My Label" description="Some description">
        <button type="button">Child Button</button>
      </SettingRow>,
    )

    expect(screen.getByText("My Label")).toBeInTheDocument()
    expect(screen.getByText("Some description")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Child Button" })).toBeInTheDocument()
  })

  it("renders FieldHelp with text", () => {
    render(<FieldHelp>Helpful text</FieldHelp>)
    expect(screen.getByText("Helpful text")).toBeInTheDocument()
  })
})
