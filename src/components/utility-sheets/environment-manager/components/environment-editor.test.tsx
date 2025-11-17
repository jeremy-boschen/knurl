import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EnvironmentEditor } from "./environment-editor"

const stateMocks = vi.hoisted(() => ({
  useEnvironment: vi.fn(),
}))

const { useEnvironment } = stateMocks

vi.mock("@/state", () => stateMocks)

vi.mock("@/components/ui/toggle", () => ({
  Toggle: ({ pressed, onPressedChange, children, ...props }: any) => (
    <button type="button" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)} {...props}>
      {children}
    </button>
  ),
}))

describe("EnvironmentEditor", () => {
  const updateEnvironment = vi.fn()
  const addEnvironmentVariable = vi.fn()
  const updateEnvironmentVariable = vi.fn()
  const deleteEnvironmentVariable = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useEnvironment.mockReturnValue({
      state: {
        collection: { id: "col-1", name: "Workspace" },
        environment: {
          id: "env-1",
          name: "Development",
          description: "Primary",
          variables: {
            "var-1": { id: "var-1", name: "API_KEY", value: "123", secure: false },
          },
        },
      },
      actions: {
        environmentsApi: () => ({
          updateEnvironment,
          addEnvironmentVariable,
          updateEnvironmentVariable,
          deleteEnvironmentVariable,
        }),
      },
    })
  })

  it("updates environment metadata and variables", async () => {
    const user = userEvent.setup()
    render(<EnvironmentEditor collectionId="col-1" environmentId="env-1" action="select" />)

    const nameInput = getByDataId("environment-editor:name-input") as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "QA" } })
    expect(updateEnvironment).toHaveBeenCalledWith("col-1", "env-1", { name: "QA" })

    const descriptionInput = getByDataId("environment-editor:description-input") as HTMLInputElement
    fireEvent.change(descriptionInput, { target: { value: "Smoke" } })
    expect(updateEnvironment).toHaveBeenCalledWith("col-1", "env-1", { description: "Smoke" })

    await user.click(getByDataId("environment-editor:add-variable-button"))
    expect(addEnvironmentVariable).toHaveBeenCalledWith("col-1", "env-1", {})

    const varNameInput = getByDataId("environment-editor:variable-name-input:var-1") as HTMLInputElement
    fireEvent.change(varNameInput, { target: { value: "TOKEN" } })
    expect(updateEnvironmentVariable).toHaveBeenCalledWith("col-1", "env-1", "var-1", { name: "TOKEN" })

    const varValueInput = getByDataId("environment-editor:variable-value-input:var-1") as HTMLInputElement
    fireEvent.change(varValueInput, { target: { value: "456" } })
    expect(updateEnvironmentVariable).toHaveBeenCalledWith("col-1", "env-1", "var-1", { value: "456" })

    await user.click(getByDataId("environment-editor:variable-secure-toggle:var-1"))
    expect(updateEnvironmentVariable).toHaveBeenCalledWith("col-1", "env-1", "var-1", { secure: true })

    await user.click(getByDataId("environment-editor:variable-delete-button:var-1"))
    expect(deleteEnvironmentVariable).toHaveBeenCalledWith("col-1", "env-1", "var-1")
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}
