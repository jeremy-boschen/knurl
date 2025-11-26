import type React from "react"
import type { ElementType } from "react"

type ClickableProps<T extends ElementType = "div"> = {
  as?: T
  role?: string
  tabIndex?: number
  disabled?: boolean
  onClick?: (event: React.MouseEvent | React.KeyboardEvent) => Promise<void> | void
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "onClick" | "onKeyDown">

export function Clickable<T extends ElementType = "div">({
  as,
  role = "button",
  tabIndex = 0,
  disabled = false,
  onClick,
  children,
  ...props
}: ClickableProps<T>) {
  const Component = as || "div"

  const handleClick = async (e: React.MouseEvent) => {
    if (disabled) {
      return
    }

    await onClick?.(e)
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (disabled) {
      return
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      await onClick?.(e)
    }
  }

  return (
    <Component
      role={role}
      tabIndex={tabIndex}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </Component>
  )
}
