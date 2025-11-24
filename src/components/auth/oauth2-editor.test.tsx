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

  it("shows device code fields when grant type is device_code", () => {
    const onUpdate = vi.fn()
    render(<OAuth2Editor auth={{ grantType: "device_code" }} onUpdate={onUpdate} onDiscover={() => {}} />)
    expect(screen.getByLabelText(/Device Authorization URL/i)).toBeInTheDocument()
  })

  it("renders token metadata and triggers fetch/delete actions", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const onFetch = vi.fn()
    const onDelete = vi.fn()
    const future = Math.floor(Date.now() / 1000) + 90
    render(
      <OAuth2Editor
        auth={{}}
        onUpdate={onUpdate}
        onDiscover={() => {}}
        token={{ value: "tok", type: "Bearer", expiresAtSec: future, onFetch, onDelete }}
      />,
    )

    expect(screen.getByLabelText(/Access Token/i)).toHaveValue("tok")
    expect(await screen.findByText(/expires in/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /fetch/i }))
    await user.click(screen.getByRole("button", { name: /delete/i }))
    expect(onFetch).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it("updates client auth and token strategy selects", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<OAuth2Editor auth={{ clientAuth: "body", tokenCaching: "always" }} onUpdate={onUpdate} onDiscover={() => {}} />)

    const clientAuth = screen.getByRole("combobox", { name: /Client Authentication/i })
    await user.click(clientAuth)
    await user.click(await screen.findByRole("option", { name: /Authorization header/i }))

    const tokenStrategy = screen.getByRole("combobox", { name: /Token Strategy/i })
    await user.click(tokenStrategy)
    await user.click(await screen.findByRole("option", { name: /always refresh/i }))

    expect(onUpdate).toHaveBeenCalledWith({ clientAuth: "basic" })
    expect(onUpdate).toHaveBeenCalledWith({ tokenCaching: "never" })
  })
})
