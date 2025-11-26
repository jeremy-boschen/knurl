import { beforeEach, describe, expect, it } from "vitest"

import extracted from "./extracted-css-vars.json"
import {
  appendMissingCustomVars,
  buildDefaultThemeCss,
  ensureCustomCssVars,
  ensureCustomCssVarsDetailed,
} from "./custom-css-vars"

type ExtractedShape = {
  customNames?: string[]
  custom?: {
    light?: Record<string, string>
    dark?: Record<string, string>
  }
  default?: {
    light?: Record<string, string>
    dark?: Record<string, string>
  }
}

const baseExtracted: ExtractedShape = {
  customNames: ["alpha-accent", "beta-shadow"],
  custom: {
    light: {
      "alpha-accent": "  #fff ; extra",
      "beta-shadow": "value-one*/ stray",
    },
    dark: {
      "beta-shadow": "  #111 ;",
    },
  },
  default: {
    light: { "base-color": "#123456" },
    dark: { "base-color": "#654321" },
  },
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

beforeEach(() => {
  const target = extracted as Record<string, unknown>
  for (const key of Object.keys(target)) {
    delete target[key]
  }
  Object.assign(target, clone(baseExtracted))
})

describe("custom css vars helpers", () => {
  it("ensures missing custom vars are inserted and tracks additions", () => {
    const { ensured, added } = ensureCustomCssVarsDetailed({
      theme: { "beta-shadow": "#222" },
      light: {},
      dark: {},
    })

    expect(ensured.theme["alpha-accent"]).toBe("#fff")
    expect(ensured.dark["beta-shadow"]).toBe("#111")
    // fallback to light when dark missing
    expect(ensured.dark["alpha-accent"]).toBe("#fff")
    expect(added.base).toEqual(["alpha-accent"])
    expect(added.dark).toEqual(["alpha-accent", "beta-shadow"])

    const ensuredOnly = ensureCustomCssVars({
      theme: { existing: "value", "beta-shadow": "keep-me" },
      light: {},
      dark: {},
    })
    expect(ensuredOnly.theme.existing).toBe("value")
    expect(ensuredOnly.theme["alpha-accent"]).toBe("#fff")
    expect(ensuredOnly.theme["beta-shadow"]).toBe("keep-me")
  })

  it("skips injections when names already exist and returns original css", () => {
    ;(extracted as ExtractedShape).customNames = []
    const css = ":root {\n  --alpha-accent: #fff;\n}\n"
    expect(appendMissingCustomVars(css)).toBe(css)
  })

  it("appends missing variables with sanitized light/dark defaults", () => {
    const css = ":root {\n  --base-color: #123456;\n}\n"
    const result = appendMissingCustomVars(css)

    expect(result).toContain(":root {")
    expect(result).toContain("--alpha-accent: #fff;")
    expect(result).toContain(".dark {")
    expect(result).toContain("--beta-shadow: #111;")
  })

  it("builds default theme css with sorted entries and custom sections", () => {
    const css = buildDefaultThemeCss()

    expect(css).toContain(":root {")
    expect(css).toContain("--base-color: #123456;")
    expect(css).toContain("/* Custom variables (from App.css) */")
    expect(css).toContain(".dark {")
    expect(css).toContain("--beta-shadow: #111;")
  })
})
