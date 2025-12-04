import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Tooltip } from "./tooltip"
import { TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

vi.mock("@/components/ui/tooltip", () => {
  const React = require("react")
  return {
    TooltipProvider: ({ children }: any) => <div data-provider>{children}</div>,
    TooltipTrigger: ({ children, asChild }: any) => (asChild ? children : <button>{children}</button>),
    TooltipContent: ({ children }: any) => <div role="tooltip">{children}</div>,
  }
})

// Mock radix-ui base to avoid portal side effects
vi.mock("radix-ui", () => ({
  Tooltip: {
    Root: ({ children, ...props }: any) => (
      <div data-slot="tooltip-root" {...props}>
        {children}
      </div>
    ),
  },
}))

describe("Tooltip wrapper", () => {
  it("renders trigger and content with provider", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button>hover me</button>
          </TooltipTrigger>
          <TooltipContent>tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )

    expect(screen.getByText("hover me")).toBeInTheDocument()
    expect(screen.getByText("tip")).toBeInTheDocument()
  })
})
