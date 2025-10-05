import { describe, expect, it, vi } from "vitest"

vi.mock("./extracted-css-vars.json", () => ({
  default: {
    default: {
      light: {},
      dark: {},
    },
    custom: {
      light: {
        alpha: "#123; /* trailing */",
        beta: "var(--color-primary)\n/* comment */",
        gamma: "   ;   ",
      },
      dark: {
        beta: "var(--dark-primary); extra",
      },
    },
    customNames: ["alpha", "beta", "gamma"],
  },
}))

import { appendMissingCustomVars, ensureCustomCssVarsDetailed } from "./custom-css-vars"

describe("custom-css-vars sanitisation", () => {
  it("sanitises and injects missing custom variables", () => {
    const base = { theme: {}, light: {}, dark: {} }

    const result = ensureCustomCssVarsDetailed(base)

    expect(result.ensured.theme.alpha).toBe("#123")
    expect(result.ensured.dark.beta).toBe("var(--dark-primary)")
    expect(result.added.base).toEqual(["alpha", "beta"])
    expect(result.added.dark).toEqual(["alpha", "beta"])
  })

  it("does not override existing values when variables are present", () => {
    const base = {
      theme: { alpha: "custom-alpha" },
      light: {},
      dark: { beta: "existing-beta" },
    }

    const result = ensureCustomCssVarsDetailed(base)

    expect(result.ensured.theme.alpha).toBe("custom-alpha")
    expect(result.ensured.dark.beta).toBe("existing-beta")
    expect(result.added.base).not.toContain("alpha")
    expect(result.added.dark).toEqual(["alpha"])
  })

  it("appends missing custom vars block to raw CSS", () => {
    const css = ":root {\n  --foo: bar;\n}\n"

    const result = appendMissingCustomVars(css)

    expect(result).toContain("/* Injected custom variables")
    expect(result).toContain("--alpha: #123;")
    expect(result).toContain("--beta: var(--dark-primary);")
    // The empty gamma value should be ignored entirely.
    expect(result).not.toMatch(/--gamma:/)
  })
})
