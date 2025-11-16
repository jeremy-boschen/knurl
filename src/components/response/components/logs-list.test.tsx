import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LogsList } from "./logs-list"

const sampleLogs = [
  {
    timestamp: "2025-11-15T13:00:00.000Z",
    level: "info" as const,
    message: "Request dispatched",
  },
  {
    timestamp: "2025-11-15T13:00:00.200Z",
    level: "error" as const,
    message: "Timeout",
    category: "network",
    phase: "connect",
  },
]

describe("LogsList", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const getByDataTestId = (id: string, root: ParentNode = document) => {
    const el = root.querySelector(`[data-test-id="${id}"]`)
    if (!el) {
      throw new Error(`Unable to find element ${id}`)
    }
    return el as HTMLElement
  }

  it("renders an empty state when no logs are provided", () => {
    render(<LogsList logs={[]} selectedLevels={[]} />)
    expect(getByDataTestId("logs-list:empty-state")).toBeTruthy()
  })

  it("allows toggling level filters and notifies the parent", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<LogsList logs={sampleLogs} selectedLevels={["info", "error"]} onSelectedLevelsChange={onChange} />)

    await user.click(getByDataTestId("logs-list:levels-popover-trigger"))
    const popover = getByDataTestId("logs-list:levels-popover-content")
    await user.click(getByDataTestId("logs-list:toggle-level-checkbox:error", popover))
    expect(onChange).toHaveBeenCalledWith(["info"])

    await user.click(getByDataTestId("logs-list:toggle-all-levels-checkbox", popover))
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining(["info", "debug", "warning", "error"]))
  })

  it("renders copy buttons for each log entry", () => {
    render(<LogsList logs={sampleLogs} selectedLevels={["info", "error"]} />)
    expect(getByDataTestId("logs-list:log-row:0")).toBeInTheDocument()
    expect(getByDataTestId("logs-list:copy-log-button:1")).toBeInTheDocument()
  })

  it("toggles line wrapping", async () => {
    const user = userEvent.setup()
    render(<LogsList logs={sampleLogs} selectedLevels={["info", "error"]} />)
    const toggle = getByDataTestId("logs-list:line-wrap-button")
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-pressed", "false")
  })
})
