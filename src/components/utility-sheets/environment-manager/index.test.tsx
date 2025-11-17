import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import EnvironmentManager from "./index"
import type { Environment } from "@/types"

const stateMocks = vi.hoisted(() => ({
  useCollection: vi.fn(),
  useEnvironments: vi.fn(),
  useEnvironment: vi.fn(),
}))

vi.mock("@/state", () => stateMocks)

const { useCollection, useEnvironments, useEnvironment } = stateMocks

vi.mock("@/components/shared/delete-dialog", () => ({
  __esModule: true,
  default: ({ context, onDelete, onCancel }: any) => (
    <div data-test-id="delete-dialog">
      <button data-test-id="delete-dialog:confirm" onClick={() => onDelete(context)}>
        Confirm
      </button>
      <button data-test-id="delete-dialog:cancel" onClick={() => onCancel(context)}>
        Cancel
      </button>
    </div>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

type EnvMap = Record<string, Environment>

const buildVars = () => ({
  "var-1": { id: "var-1", name: "API_KEY", value: "abc", secure: false },
})

describe("EnvironmentManager", () => {
  let envMap: EnvMap
  const saveCollection = vi.fn()
  const deleteEnvironment = vi.fn()
  const updateEnvironment = vi.fn()
  const addEnvironmentVariable = vi.fn()
  const updateEnvironmentVariable = vi.fn()
  const deleteEnvironmentVariable = vi.fn()

  const createEnvironment = vi.fn((collectionId: string, name: string) => {
    const newEnv: Environment = {
      id: "env-copy",
      name,
      description: "Copy",
      variables: {},
    }
    envMap[newEnv.id] = newEnv
    return newEnv
  })

  const getEnvApi = () => ({
    createEnvironment,
    updateEnvironment,
    addEnvironmentVariable,
    updateEnvironmentVariable,
    deleteEnvironmentVariable,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    envMap = {
      "env-1": { id: "env-1", name: "Development", description: "Dev env", variables: buildVars() },
      "env-2": { id: "env-2", name: "Production", description: undefined, variables: {} },
    }

    const collection = {
      id: "col-1",
      name: "Workspace",
      environments: envMap,
    }

    const getCollectionsApi = () => ({ saveCollection, deleteEnvironment })

    useCollection.mockReturnValue({
      state: { collection },
      actions: { collectionsApi: getCollectionsApi },
    })

    useEnvironments.mockReturnValue({
      state: { collection, environments: envMap },
      actions: { environmentsApi: getEnvApi },
    })

    useEnvironment.mockImplementation((_collectionId: string, environmentId: string) => ({
      state: { collection, environment: envMap[environmentId] },
      actions: { environmentsApi: getEnvApi },
    }))
  })

  it("shows loader when collection has not loaded", () => {
    useCollection.mockReturnValueOnce({
      state: { collection: null },
      actions: { collectionsApi: () => ({ saveCollection, deleteEnvironment }) },
    })
    useEnvironments.mockReturnValueOnce({
      state: { collection: null, environments: {} },
      actions: { environmentsApi: getEnvApi },
    })
    const { container } = render(<EnvironmentManager collectionId="col-1" selectedEnvironmentId={undefined} />)
    expect(container.querySelector("svg")).toBeTruthy()
  })

  it("auto-selects the available environment or honors selected id", async () => {
    const first = render(<EnvironmentManager collectionId="col-1" selectedEnvironmentId={undefined} />)
    expect(await screen.findByDisplayValue("Development")).toBeInTheDocument()
    first.unmount()

    render(<EnvironmentManager collectionId="col-1" selectedEnvironmentId="env-2" />)
    expect(await screen.findByDisplayValue("Production")).toBeInTheDocument()
  })

  it("duplicates environments and selects the copy", async () => {
    const user = userEvent.setup()
    render(<EnvironmentManager collectionId="col-1" selectedEnvironmentId={undefined} />)

    await user.click(getByDataId("environment-list:duplicate-button:env-1"))

    expect(createEnvironment).toHaveBeenCalledWith("col-1", "Development Copy")
    expect(addEnvironmentVariable).toHaveBeenCalledWith("col-1", "env-copy", expect.objectContaining({ name: "API_KEY" }))
    expect(updateEnvironment).toHaveBeenCalledWith("col-1", "env-copy", expect.objectContaining({ description: "Dev env" }))
    expect(await screen.findByDisplayValue("Development Copy")).toBeInTheDocument()
  })

  it("handles delete confirmations and cancel flows", async () => {
    const user = userEvent.setup()
    render(<EnvironmentManager collectionId="col-1" selectedEnvironmentId="env-1" />)

    await user.click(getByDataId("environment-list:delete-button:env-1"))
    expect(getByDataId("delete-dialog")).toBeInTheDocument()
    await user.click(getByDataId("delete-dialog:confirm"))
    expect(deleteEnvironment).toHaveBeenCalledWith("col-1", "env-1")

    await user.click(getByDataId("environment-list:delete-button:env-2"))
    await user.click(getByDataId("delete-dialog:cancel"))
    expect(deleteEnvironment).toHaveBeenCalledTimes(1)
  })

  it("saves the collection on unmount", () => {
    const { unmount } = render(<EnvironmentManager collectionId="col-1" selectedEnvironmentId={undefined} />)
    unmount()
    expect(saveCollection).toHaveBeenCalledWith("col-1")
  })
})
  const getByDataId = (id: string): HTMLElement => {
    const el = document.querySelector(`[data-test-id="${id}"]`)
    if (!el) {
      throw new Error(`Missing ${id}`)
    }
    return el as HTMLElement
  }
