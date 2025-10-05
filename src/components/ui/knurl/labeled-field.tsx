import type * as React from "react"
import { useId } from "react"

import { Slot } from "@radix-ui/react-slot"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib"

export type LabeledFieldProps = {
  label: React.ReactNode
  placement?: "left" | "top" | "right" | "bottom"
  /** Applied to the wrapper */
  className?: string
  /** Applied to the <Label> */
  labelClassName?: string
  /** Pass exactly one form control (Input, Select trigger, etc.) */
  children: React.ReactNode
  htmlFor?: string
}

/**
 * LabeledField
 * - Generates a unique id
 * - Renders a clickable <Label htmlFor={id}>
 * - Injects { id, aria-labelledby } into the slotted control
 */
export function LabeledField({
  label,
  placement = "left",
  className,
  labelClassName,
  children,
  htmlFor,
}: LabeledFieldProps) {
  const baseId = useId()
  const inputId = htmlFor ?? `${baseId}-input`
  const labelId = `${baseId}-label`

  const labelNode = (
    <Label id={labelId} htmlFor={inputId} className={cn("text-sm cursor-pointer", labelClassName)}>
      {label}
    </Label>
  )

  const control = (
    <Slot id={inputId} aria-labelledby={labelId}>
      {children}
    </Slot>
  )

  const isVertical = placement === "top" || placement === "bottom"
  const isReverse = placement === "right" || placement === "bottom"

  const layoutClassName = isVertical ? "flex-col items-start" : "flex-row items-center"

  return (
    <div className={cn("flex gap-2", layoutClassName, className)}>
      {isReverse ? (
        <>
          {control}
          {labelNode}
        </>
      ) : (
        <>
          {labelNode}
          {control}
        </>
      )}
    </div>
  )
}
