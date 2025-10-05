import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useRequestOptions, useSettings } from "@/state"
import { RequestOptionsPanel } from "./request-options-panel"

// Mock the state hooks
vi.mock("@/state", () => ({
  useRequestOptions: vi.fn(),
  useSettings: vi.fn(),
}))

const mockUpdateClientOption = vi.fn()
const mockUpdateAutoSave = vi.fn()

const mockOptions = {
  timeoutSecs: 30,
  maxRedirects: 5,
  userAgent: "Knurl/1.0.0",
  hostOverride: "",
  disableSsl: false,
  caPath: "",
  caText: "",
}

const mockOriginal = { ...mockOptions }

describe("RequestOptionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Provide mock implementations for the hooks
    vi.mocked(useRequestOptions).mockReturnValue({
      state: {
        options: mockOptions,
        original: mockOriginal,
        autoSave: false,
        originalAutoSave: false,
      },
      actions: {
        updateClientOption: mockUpdateClientOption,
        updateAutoSave: mockUpdateAutoSave,
      },
    } as any)

    vi.mocked(useSettings).mockReturnValue({
      state: {
        requests: {
          timeout: 60,
        },
      },
      actions: { settingsApi: vi.fn() },
    } as any) // Using 'as any' to avoid mocking the full settings state
  })

  it("renders all options with initial values", () => {
    render(<RequestOptionsPanel tabId="1" />)

    expect(screen.getByLabelText("Timeout (s)")).toHaveValue(mockOptions.timeoutSecs)
    expect(screen.getByLabelText("Max Redirects")).toHaveValue(mockOptions.maxRedirects)
    expect(screen.getByLabelText("User Agent")).toHaveValue(mockOptions.userAgent)
    expect(screen.getByRole("switch", { name: "Disable SSL" })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: "Auto Save" })).not.toBeChecked()
    expect(screen.getByLabelText("File Path")).toBeInTheDocument()
  })

  it("updates timeout when changed", () => {
    render(<RequestOptionsPanel tabId="1" />)

    const timeoutInput = screen.getByLabelText("Timeout (s)")
    fireEvent.change(timeoutInput, { target: { value: "45" } })

    expect(mockUpdateClientOption).toHaveBeenCalledWith({ timeoutSecs: 45 })
  })

  it("updates max redirects when changed", () => {
    render(<RequestOptionsPanel tabId="1" />)

    const redirectsInput = screen.getByLabelText("Max Redirects")
    fireEvent.change(redirectsInput, { target: { value: "15" } })

    expect(mockUpdateClientOption).toHaveBeenCalledWith({ maxRedirects: 15 })
  })

  it("updates user agent when changed", () => {
    render(<RequestOptionsPanel tabId="1" />)

    const userAgentInput = screen.getByLabelText("User Agent")
    fireEvent.change(userAgentInput, { target: { value: "TestAgent/1.0" } })

    expect(mockUpdateClientOption).toHaveBeenCalledWith({ userAgent: "TestAgent/1.0" })
  })

  it("updates DNS override when changed", () => {
    render(<RequestOptionsPanel tabId="1" />)
    const dnsInput = screen.getByLabelText("DNS Override")
    fireEvent.change(dnsInput, { target: { value: "api.example.com:443:127.0.0.1" } })
    expect(mockUpdateClientOption).toHaveBeenCalledWith({ hostOverride: "api.example.com:443:127.0.0.1" })
  })

  it("updates autoSave when switch is clicked", async () => {
    const user = userEvent.setup()
    render(<RequestOptionsPanel tabId="1" />)

    const autoSaveSwitch = screen.getByRole("switch", { name: "Auto Save" })
    await user.click(autoSaveSwitch)

    expect(mockUpdateAutoSave).toHaveBeenCalledWith(true)
  })

  it("updates disableSsl when switch is clicked", async () => {
    const user = userEvent.setup()
    render(<RequestOptionsPanel tabId="1" />)

    const sslSwitch = screen.getByRole("switch", { name: "Disable SSL" })
    await user.click(sslSwitch)

    expect(mockUpdateClientOption).toHaveBeenCalledWith({ disableSsl: true })
  })

  it("switches between CA bundle path and text inputs", async () => {
    const user = userEvent.setup()
    render(<RequestOptionsPanel tabId="1" />)

    // Initially, path input is visible
    expect(screen.getByPlaceholderText("/path/to/ca-bundle.pem")).toBeVisible()
    expect(screen.queryByPlaceholderText(/-----BEGIN CERTIFICATE-----/)).toBeNull()

    // Click radio to switch to pasted text
    const textRadio = screen.getByLabelText("Pasted Text")
    await user.click(textRadio)

    // Now, textarea is visible and path input is not
    expect(screen.queryByPlaceholderText("/path/to/ca-bundle.pem")).toBeNull()
    expect(screen.getByPlaceholderText(/-----BEGIN CERTIFICATE-----/)).toBeVisible()
  })

  it("updates caPath and clears caText when path is entered", () => {
    render(<RequestOptionsPanel tabId="1" />)

    const pathInput = screen.getByPlaceholderText("/path/to/ca-bundle.pem")
    fireEvent.change(pathInput, { target: { value: "/new/path.pem" } })

    expect(mockUpdateClientOption).toHaveBeenCalledWith({
      caPath: "/new/path.pem",
      caText: undefined,
    })
  })

  it("updates caText and clears caPath when text is entered", async () => {
    const user = userEvent.setup()
    render(<RequestOptionsPanel tabId="1" />)

    // Switch to pasted text mode
    const textRadio = screen.getByLabelText("Pasted Text")
    await user.click(textRadio)

    const textArea = screen.getByPlaceholderText(/-----BEGIN CERTIFICATE-----/)
    fireEvent.change(textArea, { target: { value: "my-cert-text" } })

    expect(mockUpdateClientOption).toHaveBeenCalledWith({
      caText: "my-cert-text",
      caPath: undefined,
    })
  })
})
