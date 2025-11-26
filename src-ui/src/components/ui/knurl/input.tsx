import * as React from "react"
import { useLayoutEffect, useRef, useState } from "react"

import { Slot } from "@radix-ui/react-slot"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input as BaseInput } from "@/components/ui/input"
import { assert } from "@/lib"
import { cn } from "@/lib/utils"

type Props = Omit<React.ComponentProps<typeof BaseInput>, "ref"> & {
  startAddon?: React.ReactNode
  endAddon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, Props>(
  ({ type, className, style, startAddon, endAddon, ...props }, ref) => {
    assert(type === "password" ? !endAddon : true, `Input with type=password cannot have an endAddon`)

    const [show, setShow] = React.useState(false)
    const startAddonRef = useRef<HTMLElement>(null)
    const endAddonRef = useRef<HTMLElement>(null)
    const [startAddonWidth, setStartAddonWidth] = useState(0)
    const [endAddonWidth, setEndAddonWidth] = useState(0)

    if (type === "password") {
      endAddon = (
        <Button variant="ghost" size="icon" onClick={() => setShow((show) => !show)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      )
    }

    useLayoutEffect(() => {
      const element = startAddonRef.current
      if (startAddon && element) {
        const observer = new ResizeObserver(() => {
          // 2px + 1px for the offset added renderAddon()
          setStartAddonWidth(element.offsetWidth + 3)
        })
        observer.observe(element)
        return () => observer.disconnect()
      } else {
        setStartAddonWidth(0)
      }
    }, [startAddon])

    useLayoutEffect(() => {
      const element = endAddonRef.current
      if (endAddon && element) {
        const observer = new ResizeObserver(() => {
          // 2px + 1px for the offset added renderAddon()
          setEndAddonWidth(element.offsetWidth + 3)
        })
        observer.observe(element)
        return () => observer.disconnect()
      } else {
        setEndAddonWidth(0)
      }
    }, [endAddon])

    const inputElement = (
      <BaseInput
        ref={ref}
        type={type === "password" && show ? "text" : type}
        className={cn(className, (startAddon || endAddon) && "bg-background")}
        style={{
          ...style,
          // Add padding to the input to make space for the addons.
          paddingLeft: startAddonWidth ? startAddonWidth : undefined,
          paddingRight: endAddonWidth ? endAddonWidth : undefined,
        }}
        {...props}
      />
    )

    const renderAddon = (addon: React.ReactNode, position: "start" | "end") => {
      if (!addon) {
        return null
      }

      const addonRef = position === "start" ? startAddonRef : endAddonRef

      // The Slot component allows us to pass our props (ref, className) to the
      // child component (e.g., a Button) without adding an extra div. This is
      // crucial for styling the addon as part of the input group.
      return (
        <Slot
          ref={addonRef}
          className={cn(
            // Position the addon absolutely within the relative parent.
            "absolute top-1/2 -translate-y-1/2",
            // Style it to look like part of the input.
            "flex h-[calc((var(--spacing)*9)-2px)]! items-center justify-center",
            // Adjust position and border-radius based on whether it's a start or end addon.
            position === "start" ? "left-[1px] rounded-l-md rounded-r-none" : "right-[1px] rounded-r-md rounded-l-none",
          )}
        >
          {addon}
        </Slot>
      )
    }

    // If no addons and not a password input, render BaseInput directly to avoid unnecessary wrappers
    if (!startAddon && !endAddon) {
      return <BaseInput ref={ref} type={type} className={className} style={style} {...props} />
    }

    // Otherwise, wrap in a flex container for addons or password button
    return (
      <div className="group relative flex w-full items-center">
        {renderAddon(startAddon, "start")}
        {inputElement}
        {renderAddon(endAddon, "end")}
      </div>
    )
  },
)
Input.displayName = "Input"
