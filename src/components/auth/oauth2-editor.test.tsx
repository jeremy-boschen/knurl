import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { OAuth2Editor } from "./oauth2-editor"

describe("OAuth2Editor", () => {
  it("calls onDiscover when Discover button is clicked", async () => {
    const user = userEvent.setup()
    const onDiscover = vi.fn()
    render(<OAuth2Editor auth={{}} onUpdate={() => {}} onDiscover={onDiscover} />)
    const btn = screen.getByRole("button", { name: /discover/i })
    await user.click(btn)
    expect(onDiscover).toHaveBeenCalled()
  })

  it("changes grant type via select and calls onUpdate", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<OAuth2Editor auth={{ grantType: "client_credentials" }} onUpdate={onUpdate} onDiscover={() => {}} />)

    const trigger = screen.getByRole("combobox", { name: /grant type/i })
    await user.click(trigger)
    const opt = await screen.findByRole("option", { name: /refresh token/i })
    await user.click(opt)

    expect(onUpdate).toHaveBeenCalledWith({ grantType: "refresh_token" })
  })
})

