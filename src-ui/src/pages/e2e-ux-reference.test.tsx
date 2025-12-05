import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import E2EUxReferencePage from "./e2e-ux-reference"

describe("E2E UX reference page", () => {
  it("exposes stable interactions for helpers", async () => {
    const user = userEvent.setup()
    render(<E2EUxReferencePage />)

    expect(getByDataId("ux-reference:select-value")).toHaveTextContent(/Selected:\s+alpha/i)

    await user.click(getByDataId("ux-reference:select-trigger"))
    await user.click(await findByDataId("ux-reference:select-option:bravo"))
    expect(getByDataId("ux-reference:select-value")).toHaveTextContent(/Selected:\s+bravo/i)

    await user.click(getByDataId("ux-reference:dropdown-trigger"))
    await user.click(await findByDataId("ux-reference:dropdown-item:rename"))
    expect(getByDataId("ux-reference:dropdown-value")).toHaveTextContent(/rename$/)

    const input = getByDataId("ux-reference:input") as HTMLInputElement
    await user.type(input, "demo")
    expect(getByDataId("ux-reference:input-value")).toHaveTextContent("demo")

    const textarea = getByDataId("ux-reference:textarea") as HTMLTextAreaElement
    await user.type(textarea, "longer")
    expect(getByDataId("ux-reference:textarea-value")).toHaveTextContent(/Length:\s+6/)

    await user.click(getByDataId("ux-reference:switch"))
    await user.click(getByDataId("ux-reference:checkbox"))
    const toggleState = getByDataId("ux-reference:toggle-state")
    expect(toggleState).toHaveTextContent(/Switch:\s+on/)
    expect(toggleState).toHaveTextContent(/Checkbox:\s+checked/)

    const button = getByDataId("ux-reference:button-primary")
    await user.click(button)
    await user.click(button)
    expect(getByDataId("ux-reference:button-count")).toHaveTextContent(/2$/)
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}

const findByDataId = async (id: string): Promise<HTMLElement> => waitFor(() => getByDataId(id))
