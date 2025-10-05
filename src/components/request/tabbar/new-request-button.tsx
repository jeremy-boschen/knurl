import type * as React from "react"

import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useOpenTabs } from "@/state"

type NewRequestButtonProps = {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  variant?: "compact" | "full" | "ghost"
}

export default function NewRequestButton({ onClick, variant = "compact" }: NewRequestButtonProps) {
  const {
    actions: { requestTabsApi },
  } = useOpenTabs()

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event)
    } else {
      void requestTabsApi.createRequestTab()
    }
  }

  if (variant === "full") {
    return (
      <Button variant="ghost" size="default" className="h-8 m-4" onClick={handleClick}>
        <PlusIcon className="mr-1 h-4 w-4" />
        New Request
      </Button>
    )
  }

  if (variant === "ghost") {
    return (
      <Button variant="ghost" size="default" className="h-8" onClick={handleClick}>
        <PlusIcon className="mr-1 h-4 w-4" />
        New Request
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 m-4" onClick={handleClick}>
      <PlusIcon className="h-4 w-4" />
    </Button>
  )
}
