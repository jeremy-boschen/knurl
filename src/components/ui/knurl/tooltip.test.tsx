import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./tooltip"

describe("Tooltip", () => {
  it("renders radix root without wrapping its own provider", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button>Hover me</button>
          </TooltipTrigger>
          <TooltipContent data-testid="tooltip-content">Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )

    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument()
  })
})
