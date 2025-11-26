import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import React from "react"

import { ImportPreviewStep } from "./import-preview-step"

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      data-role="checkbox"
      checked={checked === true}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      {...props}
    />
  ),
}))

const requests = [
  { id: "req-1", name: "List Users", method: "GET", url: "https://api/users" } as any,
  { id: "req-2", name: "Create Post", method: "POST", url: "https://api/posts" } as any,
]

const environments = [
  { id: "env-1", name: "Development", variables: { foo: { id: "v1" } } } as any,
]

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element ${id}`)
  }
  return el as HTMLElement
}

describe("ImportPreviewStep", () => {
  it("toggles all requests and individual entries", async () => {
    const onToggleAllRequests = vi.fn()
    const onToggleRequest = vi.fn()
    const user = userEvent.setup()

    render(
      <ImportPreviewStep
        requests={requests}
        environments={environments}
        selectedRequests={new Set(["req-1"])}
        selectedEnvironments={new Set(["env-1"])}
        reqMasterState="indeterminate"
        envMasterState
        onToggleRequest={onToggleRequest}
        onToggleAllRequests={onToggleAllRequests}
        onToggleEnvironment={vi.fn()}
        onToggleAllEnvironments={vi.fn()}
        filter=""
        onFilterChange={vi.fn()}
      />,
    )

    await user.click(getByDataId("import-preview:requests-master-checkbox"))
    expect(onToggleAllRequests).toHaveBeenCalledWith(true)

    await user.click(getByDataId("import-preview:request-checkbox:req-1"))
    expect(onToggleRequest).toHaveBeenCalledWith("req-1", false)
  })

  it("filters requests list and clears the filter", async () => {
    const user = userEvent.setup()

    const Wrapper = () => {
      const [filter, setFilter] = React.useState("")
      return (
        <ImportPreviewStep
          requests={requests}
          environments={environments}
          selectedRequests={new Set()}
          selectedEnvironments={new Set()}
          reqMasterState={false}
          envMasterState={false}
          onToggleRequest={vi.fn()}
          onToggleAllRequests={vi.fn()}
          onToggleEnvironment={vi.fn()}
          onToggleAllEnvironments={vi.fn()}
          filter={filter}
          onFilterChange={setFilter}
        />
      )
    }

    render(<Wrapper />)

    const filterInput = getByDataId("import-preview:filter-input") as HTMLInputElement
    await user.type(filterInput, "post")
    expect(screen.queryByText(/List Users/)).not.toBeInTheDocument()
    expect(screen.getByText(/Create Post/)).toBeInTheDocument()

    await user.click(getByDataId("import-preview:filter-clear-button"))
    expect(screen.getByText(/List Users/)).toBeInTheDocument()
  })

  it("enables environment master toggle only when environments exist", async () => {
    const user = userEvent.setup()
    const onToggleAllEnvironments = vi.fn()

    const { rerender } = render(
      <ImportPreviewStep
        requests={requests}
        environments={[]}
        selectedRequests={new Set()}
        selectedEnvironments={new Set()}
        reqMasterState={false}
        envMasterState={false}
        onToggleRequest={vi.fn()}
        onToggleAllRequests={vi.fn()}
        onToggleEnvironment={vi.fn()}
        onToggleAllEnvironments={onToggleAllEnvironments}
        filter=""
        onFilterChange={vi.fn()}
      />,
    )

    const disabledToggle = getByDataId("import-preview:environments-master-checkbox") as HTMLInputElement
    expect(disabledToggle).toBeDisabled()

    rerender(
      <ImportPreviewStep
        requests={requests}
        environments={environments}
        selectedRequests={new Set()}
        selectedEnvironments={new Set()}
        reqMasterState={false}
        envMasterState={false}
        onToggleRequest={vi.fn()}
        onToggleAllRequests={vi.fn()}
        onToggleEnvironment={vi.fn()}
        onToggleAllEnvironments={onToggleAllEnvironments}
        filter=""
        onFilterChange={vi.fn()}
      />,
    )

    await user.click(getByDataId("import-preview:environments-master-checkbox"))
    expect(onToggleAllEnvironments).toHaveBeenCalledWith(true)
  })
})
