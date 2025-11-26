import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useSettings } from "@/state"
import RequestsSection from "./requests"

vi.mock("@/state", () => ({
  useSettings: vi.fn(),
}))

// Make the debounced callbacks run immediately for tests
vi.mock("@/hooks/use-debounced-callback", () => ({
  useDebouncedCallback: (fn: any) => fn,
}))

describe("RequestsSection", () => {
  const setRequestTimeout = vi.fn()
  const setMaxRedirects = vi.fn()
  const setSslVerify = vi.fn()
  const setProxyServer = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSettings).mockReturnValue({
      state: {
        requests: {
          timeout: 30,
          maxRedirects: 10,
          disableSsl: false,
          proxyServer: "",
        },
      },
      actions: {
        settingsApi: () => ({ setRequestTimeout, setMaxRedirects, setSslVerify, setProxyServer }),
      },
    } as any)
  })

  it("changes timeout and max redirects, toggles SSL verify and sets proxy", async () => {
    const user = userEvent.setup()
    render(<RequestsSection />)

    const spinboxes = screen.getAllByRole("spinbutton")
    const timeoutInput = spinboxes[0]
    const redirectsInput = spinboxes[1]

    fireEvent.change(timeoutInput, { target: { value: "45" } })
    expect(setRequestTimeout).toHaveBeenCalledWith(45)

    fireEvent.change(redirectsInput, { target: { value: "3" } })
    expect(setMaxRedirects).toHaveBeenCalledWith(3)

    const sslSwitch = screen.getByRole("switch")
    await user.click(sslSwitch)
    expect(setSslVerify).toHaveBeenCalledWith(false)

    const proxyInput = screen.getByPlaceholderText("http://proxy.example.com:8080")
    fireEvent.change(proxyInput, { target: { value: "  http://p:1  " } })
    expect(setProxyServer).toHaveBeenCalledWith("http://p:1")
  })
})
