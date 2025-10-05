import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { Input } from "./input"
import { Button } from "@/components/ui/button"

describe("Knurl Input", () => {
  it("toggles password visibility when the eye button is clicked", async () => {
    const user = userEvent.setup()
    render(<Input type="password" placeholder="Password" />)

    const input = screen.getByPlaceholderText("Password") as HTMLInputElement
    expect(input.type).toBe("password")

    // There should be exactly one toggle button rendered for password inputs
    const toggle = screen.getByRole("button")

    await user.click(toggle)
    expect(input.type).toBe("text")

    await user.click(toggle)
    expect(input.type).toBe("password")
  })

  it("renders start and end addons without crashing", () => {
    render(
      <Input
        placeholder="With addons"
        startAddon={<span data-testid="start">S</span>}
        endAddon={<span data-testid="end">E</span>}
      />,
    )

    expect(screen.getByTestId("start")).toBeInTheDocument()
    expect(screen.getByTestId("end")).toBeInTheDocument()
  })

  it("renders start/end addons with buttons and input present", async () => {
    render(
      <div style={{ width: 400 }}>
        <Input
          type="text"
          placeholder="name"
          startAddon={<Button size="sm">S</Button>}
          endAddon={<Button size="sm">E</Button>}
        />
      </div>,
    )
    expect(await screen.findByRole("button", { name: "S" })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "E" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("name")).toBeInTheDocument()
  })
})
