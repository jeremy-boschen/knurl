import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CookieList } from "./cookie-list"
import type { Cookie } from "@/types"

const stateMocks = vi.hoisted(() => ({
  useRequestCookies: vi.fn(),
}))

vi.mock("@/state", () => ({
  useRequestCookies: stateMocks.useRequestCookies,
}))

describe("CookieList", () => {
  const addCookieFromResponse = vi.fn()
  let writeTextSpy: ReturnType<typeof vi.fn>
  let restoreNavigator: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    stateMocks.useRequestCookies.mockReturnValue({
      actions: {
        addCookieFromResponse,
      },
    })

    writeTextSpy = vi.fn().mockResolvedValue(undefined)
    const baseNavigator = window.navigator
    const navigatorStub = Object.create(baseNavigator)
    navigatorStub.clipboard = {
      writeText: writeTextSpy,
    }
    Object.defineProperty(window, "navigator", {
      value: navigatorStub,
      configurable: true,
    })
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorStub,
      configurable: true,
    })
    restoreNavigator = () => {
      Object.defineProperty(window, "navigator", {
        value: baseNavigator,
        configurable: true,
      })
      Object.defineProperty(globalThis, "navigator", {
        value: baseNavigator,
        configurable: true,
      })
    }
  })

  const cookies: Cookie[] = [
    {
      name: "session",
      value: "xyz",
      domain: "knurl.dev",
      path: "/",
      expires: undefined,
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    },
  ]

  it("renders cookie rows with flags", () => {
    render(<CookieList tabId="tab-1" cookies={cookies} />)
    expect(getByDataId("cookie-list:row:session")).toHaveTextContent("session")
    expect(screen.getByText(/HttpOnly/)).toBeInTheDocument()
    expect(screen.getByText(/Secure/)).toBeInTheDocument()
    expect(screen.getByText(/SameSite=Strict/)).toBeInTheDocument()
  })

  it("copies cookie values and adds them to request state", async () => {
    render(<CookieList tabId="tab-2" cookies={cookies} />)
    fireEvent.click(getByDataId("cookie-list:copy-button:session"))
    expect(writeTextSpy).toHaveBeenCalledWith("session=xyz")

    const user = userEvent.setup()
    await user.click(getByDataId("cookie-list:add-to-request-button:session"))
    expect(addCookieFromResponse).toHaveBeenCalledWith(expect.objectContaining({ name: "session" }))
  })

  afterEach(() => {
    restoreNavigator?.()
  })
})
  const getByDataId = (id: string): HTMLElement => {
    const el = document.querySelector(`[data-test-id="${id}"]`)
    if (!el) {
      throw new Error(`Missing ${id}`)
    }
    return el as HTMLElement
  }
