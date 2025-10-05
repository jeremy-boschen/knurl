import React from "react"
import { ZodError, z } from "zod"

type FormErrors<T> = Partial<Record<keyof T, string>>

// biome-ignore lint/suspicious/noExplicitAny: Need
type Schema = z.ZodObject<any, any>

// FIX 1: Constrain the schema `S` to be a ZodObject.
// This guarantees that `z.input<S>` will be an object type.
interface UseZodFormOptions<S extends Schema> {
  schema: S
  initialValues: Partial<z.input<S>> | undefined
  onSubmit: (data: z.output<S>) => void | Promise<void>
}

export function useZodForm<S extends Schema>({ schema, initialValues, onSubmit }: UseZodFormOptions<S>) {
  type Values = z.input<S>

  const [values, setValues] = React.useState<Values | Partial<Values>>(initialValues ?? {})
  const [errors, setErrors] = React.useState<FormErrors<Values>>({})
  const [submitting, setSubmitting] = React.useState<boolean>(false)

  const handleChange = (name: keyof Values, value: unknown) => {
    // This is now type-safe because `prev` is guaranteed to be an object.
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      //TODO: Refactor this to call onSubmit() and catch ZodError, which is the same type as result.error
      const result = schema.safeParse(values)
      if (!result.success) {
        const formattedErrors: FormErrors<Values> = {}
        for (const issue of result.error.issues) {
          const fieldName = issue.path[0] as keyof Values
          formattedErrors[fieldName] = issue.message
        }
        setErrors(formattedErrors)
        return
      }
      setErrors({})
      await onSubmit(result.data)
    } catch (e) {
      console.error(e instanceof ZodError ? z.prettifyError(e) : e)
      throw e
    } finally {
      setSubmitting(false)
    }
  }

  const register = (name: keyof Values) => ({
    name,
    value: values[name] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleChange(name, e.target.value)
    },
  })

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
    submitting,
    register,
  }
}
