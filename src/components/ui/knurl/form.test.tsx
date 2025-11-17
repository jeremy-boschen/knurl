import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, beforeEach, vi } from "vitest"

const formMock = vi.hoisted(() => {
  const handleChange = vi.fn()
  const register = vi.fn((name: string) => ({
    name,
    onChange: (event: any) => handleChange(name, event.target.value),
    value: "",
  }))
  return {
    register,
    errors: {} as Record<string, string>,
    values: {} as Record<string, any>,
    handleChange,
    handleSubmit: vi.fn((event) => event?.preventDefault?.()),
    submitting: false,
  }
})

vi.mock("@/hooks/use-zod-form", () => ({
  useZodForm: () => formMock,
}))

import { Form, FormControl } from "./form"

function Select({ value, onValueChange }: any) {
  return (
    <button data-testid="select" type="button" onClick={() => onValueChange("dark")}>
      {value ?? "unset"}
    </button>
  )
}

function Checkbox({ checked, onCheckedChange }: any) {
  return (
    <button data-testid="checkbox" type="button" aria-pressed={checked} onClick={() => onCheckedChange(!checked)}>
      {checked ? "on" : "off"}
    </button>
  )
}

function Switch({ checked, onCheckedChange }: any) {
  return (
    <button data-testid="switch" type="button" aria-pressed={checked} onClick={() => onCheckedChange(!checked)}>
      switch
    </button>
  )
}

function RadioGroup({ value, onValueChange }: any) {
  return (
    <button data-testid="radio" type="button" onClick={() => onValueChange(value === "alpha" ? "beta" : "alpha")}>
      {value}
    </button>
  )
}

function ToggleGroup({ value, onValueChange }: any) {
  return (
    <button
      data-testid="toggle-group"
      type="button"
      onClick={() => onValueChange(value.includes("beta") ? value.filter((id: string) => id !== "beta") : [...value, "beta"])}
    >
      group
    </button>
  )
}

function Slider({ onValueChange }: any) {
  return (
    <button data-testid="slider" type="button" onClick={() => onValueChange([42])}>
      slider
    </button>
  )
}

function Toggle({ pressed, onPressedChange }: any) {
  return (
    <button data-testid="toggle" type="button" onClick={() => onPressedChange(!pressed)}>
      toggle
    </button>
  )
}

Select.displayName = "Select"
Checkbox.displayName = "Checkbox"
Switch.displayName = "Switch"
RadioGroup.displayName = "RadioGroup"
ToggleGroup.displayName = "ToggleGroup"
Slider.displayName = "Slider"
Toggle.displayName = "Toggle"

describe("Form + FormControl", () => {
  beforeEach(() => {
    formMock.errors = {}
    formMock.values = {
      theme: "light",
      agree: false,
      power: false,
      tone: "alpha",
      tags: ["alpha"],
      range: [0],
      pinned: false,
      notes: "",
    }
    formMock.handleChange.mockClear()
    formMock.register.mockClear()
  })

  it("bridges specialized controls through handleChange", async () => {
    const user = userEvent.setup()
    formMock.errors = { theme: "Pick a theme" }

    render(
      <Form schema={{}} onSubmit={vi.fn()}>
        <FormControl name="theme" label="Theme">
          <Select />
        </FormControl>
        <FormControl name="agree" label="Agree">
          <Checkbox />
        </FormControl>
        <FormControl name="power">
          <Switch />
        </FormControl>
        <FormControl name="tone">
          <RadioGroup />
        </FormControl>
        <FormControl name="tags">
          <ToggleGroup />
        </FormControl>
        <FormControl name="range">
          <Slider />
        </FormControl>
        <FormControl name="pinned">
          <Toggle />
        </FormControl>
        <FormControl name="notes">
          <input data-testid="text-input" />
        </FormControl>
      </Form>
    )

    await user.click(screen.getByTestId("select"))
    expect(formMock.handleChange).toHaveBeenCalledWith("theme", "dark")
    formMock.handleChange.mockClear()

    await user.click(screen.getByTestId("checkbox"))
    expect(formMock.handleChange).toHaveBeenCalledWith("agree", true)
    formMock.handleChange.mockClear()

    await user.click(screen.getByTestId("switch"))
    expect(formMock.handleChange).toHaveBeenCalledWith("power", true)
    formMock.handleChange.mockClear()

    await user.click(screen.getByTestId("radio"))
    expect(formMock.handleChange).toHaveBeenCalledWith("tone", "beta")
    formMock.handleChange.mockClear()

    await user.click(screen.getByTestId("toggle-group"))
    expect(formMock.handleChange).toHaveBeenCalledWith("tags", ["alpha", "beta"])
    formMock.handleChange.mockClear()

    await user.click(screen.getByTestId("slider"))
    expect(formMock.handleChange).toHaveBeenCalledWith("range", [42])
    formMock.handleChange.mockClear()

    await user.click(screen.getByTestId("toggle"))
    expect(formMock.handleChange).toHaveBeenCalledWith("pinned", true)

    expect(formMock.register).toHaveBeenCalledWith("notes")
    expect(screen.getByText("Pick a theme")).toBeInTheDocument()
  })
})
