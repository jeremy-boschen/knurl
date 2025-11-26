import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const setupModule = async (ensureResult: unknown) => {
  vi.resetModules()
  vi.doMock("@/lib/theme/custom-css-vars", () => ({
    appendMissingCustomVars: (css: string) => css,
    buildDefaultThemeCss: () => "/*default*/",
    ensureCustomCssVarsDetailed: () => ensureResult,
  }))
  const module = await import("./index")
  return module.generateThemeCss
}

describe("generateThemeCss helper", () => {
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((cb: TimerHandler) => {
      if (typeof cb === "function") {
        cb()
      }
      return 0 as unknown as number
    })
  })

  afterEach(() => {
    setTimeoutSpy.mockRestore()
    vi.useRealTimers()
  })

  it(
    "returns empty output when cssVars are missing",
    { timeout: 10000 },
    async () => {
      const generateThemeCss = await setupModule({ ensured: {}, added: { base: [], dark: [] } })
      expect(generateThemeCss({} as any)).toBe("")
    },
  )

  it("renders root and dark blocks with custom markers", async () => {
    const generateThemeCss = await setupModule({
      ensured: {
        theme: { base: "#fff" },
        light: { lightOnly: "#eee" },
        dark: { darkOnly: "#111" },
      },
      added: {
        base: ["lightOnly"],
        dark: ["darkOnly"],
      },
    })

    const css = generateThemeCss({ cssVars: { theme: {}, light: {}, dark: {} } } as any)

    expect(css).toContain(":root {")
    expect(css).toContain("/* Custom variables added by app */")
    expect(css).toContain(".dark {")
    expect(css).toContain("--darkOnly: #111;")
  })
})
