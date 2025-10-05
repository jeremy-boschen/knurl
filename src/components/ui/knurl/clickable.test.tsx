import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Clickable } from "./clickable"

function setup(onClick = vi.fn(), disabled = false) {
  render(
    <Clickable onClick={onClick} disabled={disabled}>
      Click me
    </Clickable>,
  )
  return { onClick }
}

describe("Clickable", () => {
  it("invokes onClick on mouse click and keyboard Enter/Space", async () => {
    const user = userEvent.setup()
    const { onClick } = setup()

    const el = screen.getByRole("button")

    await user.click(el)
    await user.keyboard("{Enter}")
    await user.keyboard(" ")

    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it("does not fire when disabled", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    setup(onClick, true)

    const el = screen.getByRole("button")
    await user.click(el)
    await user.keyboard("{Enter}")
    await user.keyboard(" ")

    expect(onClick).not.toHaveBeenCalled()
  })
})
