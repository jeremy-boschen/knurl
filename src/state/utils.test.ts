import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { zParse } from "./utils"

describe("zParse", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  })

  it("should return parsed data for valid input", () => {
    const data = { name: "John", age: 30 }
    const result = zParse(schema, data)
    expect(result).toEqual(data)
  })

  it("should throw a Zod error for invalid input", () => {
    const data = { name: "John", age: "thirty" }
    expect(() => zParse(schema, data)).toThrow(z.ZodError)
  })

  it("should log an error to the console when parsing fails", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const data = { name: 123, age: 30 }

    expect(() => zParse(schema, data)).toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
