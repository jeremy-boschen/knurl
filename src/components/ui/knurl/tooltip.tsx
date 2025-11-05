import { Tooltip as TooltipPrimitive } from "radix-ui"
import type * as React from "react"

// Re-export the trigger and content from the original shadcn component
export { TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

// Create a new Tooltip component that does NOT wrap itself in a provider.
// This ensures it respects the global provider's settings.
function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

export { Tooltip }
