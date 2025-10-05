/** biome-ignore-all lint/suspicious/noExplicitAny: Required for field support */
import React, { createContext, useContext, useId } from "react"

import type { z } from "zod"

import { Label } from "@/components/ui/label"
import { useZodForm } from "@/hooks/use-zod-form"
import { cn } from "@/lib/utils"

/**
 * SUPPORTED FORM COMPONENT TYPES
 *
 * The FormField component automatically detects and handles the following form-capable components
 * using their displayName properties:
 *
 * Boolean Value Components:
 * - Checkbox: displayName="Checkbox", onCheckedChange, checked prop
 * - Switch: displayName="Switch", onCheckedChange, checked prop
 * - Toggle: displayName="Toggle", onPressedChange, pressed prop
 *
 * Single Value Selection:
 * - Select: displayName="Select", onValueChange, value prop (string)
 * - RadioGroup: displayName="RadioGroup", onValueChange, value prop (string)
 *
 * Multi-Value Selection:
 * - ToggleGroup: displayName="ToggleGroup", onValueChange, value prop (string[])
 *
 * Range Values:
 * - Slider: displayName="Slider", onValueChange, value prop (number[])
 *
 * Standard Input Components (handled by default case):
 * - Input: displayName="Input", onChange, value prop (string)
 * - Textarea: displayName="Textarea", onChange, value prop (string)
 *
 * Total: 9 supported form component types
 */

/**
 * The `form` object has a specific type derived from the generic schema `S`, while the `FormContext`
 * requires a general, non-generic type. TypeScript cannot reconcile the specific function signatures
 * (e.g., `register: (name: "email" | "password") => ...`) with the general ones required by the
 * (`register: (name: string) => ...`). This assertion bridges that gap as a private implementation
 * detail, while the public API of the `Form` and `FormField` components remains fully type-safe.
 */
type Schema = z.ZodObject<any, any>

// The Context must have a general, non-generic type. We define its shape using a general-purpose ZodObject to create the base type.
const FormContext = createContext<ReturnType<typeof useZodForm<z.ZodObject<any>>> | null>(null)

function useFormContext() {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error("FormField must be used within a Form component")
  }
  return context
}

// Constrain the schema prop to ensure it's always an object schema.
type FormProps<S extends Schema> = {
  schema: S
  initialValues?: Partial<z.input<S>>
  onSubmit: (data: z.output<S>) => void
  className?: string
  children: React.ReactNode
}

function Form<S extends Schema>({ schema, initialValues, onSubmit, className, children }: FormProps<S>) {
  const form = useZodForm({ schema, initialValues, onSubmit })

  return (
    <FormContext.Provider value={form as any}>
      <form onSubmit={form.handleSubmit} aria-disabled={form.submitting}>
        <fieldset disabled={form.submitting} className={cn("space-y-4", className)}>
          {children}
        </fieldset>
      </form>
    </FormContext.Provider>
  )
}

type FormFieldProps = {
  name: string
  label?: string
  className?: string
  children: React.ReactElement
}

function FormControl({ name, label, className, children }: FormFieldProps) {
  // Thanks to the context, FormField does not need to be generic.
  // It consumes the general context and works for any form.
  const { register, errors, values, handleChange } = useFormContext()
  const fieldError = errors[name]
  const id = useId()

  // Get the form control type from the component
  const formControlType = getFormControlType(children)

  let child: React.ReactElement

  switch (formControlType) {
    case "select":
      child = React.cloneElement(children as any, {
        value: values[name] || "",
        id,
        onValueChange: (value: string) => handleChange(name, value),
      })
      break

    case "checkbox":
    case "switch":
      child = React.cloneElement(children as any, {
        checked: !!values[name],
        onCheckedChange: (checked: boolean) => handleChange(name, checked),
        id,
        "aria-invalid": !!fieldError,
        "aria-describedby": fieldError ? `${id}-error` : undefined,
      })
      break

    case "radio-group":
      child = React.cloneElement(children as any, {
        value: values[name] || "",
        onValueChange: (value: string) => handleChange(name, value),
        id,
        "aria-invalid": !!fieldError,
        "aria-describedby": fieldError ? `${id}-error` : undefined,
      })
      break

    case "toggle-group":
      child = React.cloneElement(children as any, {
        value: values[name] || [],
        onValueChange: (value: string[]) => handleChange(name, value),
        id,
        "aria-invalid": !!fieldError,
        "aria-describedby": fieldError ? `${id}-error` : undefined,
      })
      break

    case "slider":
      child = React.cloneElement(children as any, {
        value: values[name] || [0],
        onValueChange: (value: number[]) => handleChange(name, value),
        id,
        "aria-invalid": !!fieldError,
        "aria-describedby": fieldError ? `${id}-error` : undefined,
      })
      break

    case "toggle":
      child = React.cloneElement(children as any, {
        pressed: !!values[name],
        onPressedChange: (pressed: boolean) => handleChange(name, pressed),
        id,
        "aria-invalid": !!fieldError,
        "aria-describedby": fieldError ? `${id}-error` : undefined,
      })
      break

    default:
      // Handle regular form controls (Input, Textarea, etc.)
      child = React.cloneElement(children, {
        ...register(name),
        // @ts-expect-error: non-issue
        id,
        "aria-invalid": !!fieldError,
        "aria-describedby": fieldError ? `${id}-error` : undefined,
      })
      break
  }

  return (
    <div className={cn("grid grid-cols-[8rem_1fr] items-center gap-x-4", className)}>
      {label && (
        <Label htmlFor={id} className={cn("text-muted-foreground text-right", fieldError && "text-destructive")}>
          {label}
        </Label>
      )}
      <div className="space-y-2">
        {child}
        {fieldError && (
          <p id={`${id}-error`} className="text-sm text-error font-medium">
            {fieldError}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Get the form control type from the component using displayName
 *
 * Supported form component types:
 * - Checkbox: onCheckedChange, checked prop
 * - Select: onValueChange, value prop
 * - Switch: onCheckedChange, checked prop
 * - RadioGroup: onValueChange, value prop
 * - ToggleGroup: onValueChange, value prop (array)
 * - Slider: onValueChange, value prop (number array)
 * - Toggle: onPressedChange, pressed prop
 */
function getFormControlType(element: React.ReactElement): string {
  if (!React.isValidElement(element)) {
    return "default"
  }

  // Use name to detect the component type
  const name = (element.type as any)?.name
  if (name) {
    switch (name) {
      case "Checkbox":
        return "checkbox"
      case "Select":
        return "select"
      case "Switch":
        return "switch"
      case "RadioGroup":
        return "radio-group"
      case "ToggleGroup":
        return "toggle-group"
      case "Slider":
        return "slider"
      case "Toggle":
        return "toggle"
      default:
        return "default"
    }
  }

  // Fallback to default behavior for components without displayName
  return "default"
}

export { Form, FormControl }
