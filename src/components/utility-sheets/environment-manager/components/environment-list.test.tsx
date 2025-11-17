import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EnvironmentList } from "./environment-list"
import type { Environment } from "@/types"

const stateMocks = vi.hoisted(() => ({
  useEnvironments: vi.fn(),
}))

const { useEnvironments } = stateMocks

vi.mock("@/state", () => stateMocks)

describe("EnvironmentList", () => {
  const createEnvironment = vi.fn()
  let environments: Record<string, Environment>

  beforeEach(() => {
    vi.clearAllMocks()
    environments = {
      "env-1": { id: "env-1", name: "Development", description: "Primary", variables: {} },
      "env-2": { id: "env-2", name: "Production", description: "", variables: {} },
    }
    useEnvironments.mockReturnValue({
      state: { collection: { id: "col-1", name: "Collection" }, environments },
      actions: { environmentsApi: () => ({ createEnvironment }) },
    })
  })

  it("renders items and highlights the selected environment", () => {
    render(<EnvironmentList collectionId="col-1" selectedId="env-2" onAction={vi.fn()} />)
    const selected = getByDataId("environment-list:item:env-2")
    expect(selected.className).toContain("bg-primary/10")
  })

  it("creates a new environment via the add button", async () => {
    const user = userEvent.setup()
    render(<EnvironmentList collectionId="col-1" selectedId={undefined} onAction={vi.fn()} />)
    await user.click(getByDataId("environment-list:add-button"))
    expect(createEnvironment).toHaveBeenCalledWith("col-1", "Untitled Environment")
  })

  it("emits select, duplicate, and delete actions", async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(<EnvironmentList collectionId="col-1" selectedId={undefined} onAction={onAction} />)

    await user.click(getByDataId("environment-list:item:env-1"))
    expect(onAction).toHaveBeenCalledWith(environments["env-1"], "select")

    await user.click(getByDataId("environment-list:duplicate-button:env-1"))
    expect(onAction).toHaveBeenCalledWith(environments["env-1"], "duplicate")

    await user.click(getByDataId("environment-list:delete-button:env-1"))
    expect(onAction).toHaveBeenCalledWith(environments["env-1"], "delete")
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}
