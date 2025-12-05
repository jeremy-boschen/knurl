import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

describe("Tooltip wrapper", () => {
  it("passes props to Radix root and shows content when defaultOpen", async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">Hover me</button>
          </TooltipTrigger>
          <TooltipContent side="top">Hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )

    const trigger = screen.getByRole("button", { name: /hover me/i })
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger")

    await user.hover(trigger)
    expect(await screen.findByRole("tooltip")).toBeInTheDocument()
    expect(screen.getAllByText("Hint")[0]).toBeInTheDocument()
  })
})
