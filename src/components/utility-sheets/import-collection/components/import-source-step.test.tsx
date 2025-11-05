import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ImportSourceStep } from "./import-source-step"

describe("ImportSourceStep", () => {
  it("hides OpenAPI options when auto-detect resolves to native", () => {
    render(
      <ImportSourceStep
        importFormat="auto"
        detectedFormat="native"
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onFormatChange={vi.fn()}
      />,
    )

    expect(screen.queryByRole("switch", { name: /group requests/i })).toBeNull()
  })

  it("shows and toggles the group-by-tags switch when OpenAPI is active", async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()

    render(
      <ImportSourceStep
        importFormat="openapi"
        detectedFormat="openapi"
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onFormatChange={vi.fn()}
        showOpenApiOptions
        groupByTags
        onGroupByTagsChange={handleToggle}
      />,
    )

    const switchControl = screen.getByRole("switch", { name: /group requests/i })
    expect(switchControl).toBeInTheDocument()

    await user.click(switchControl)
    expect(handleToggle).toHaveBeenCalledWith(false)
  })
})
