import React, { useCallback } from "react"

import { MonitorCogIcon, MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { useTheme } from "@/state"

export const ModeToggle = React.memo(function ModeToggle() {
  const {
    state: { theme },
    actions: { setTheme },
  } = useTheme()

  const handleThemeChange = useCallback(() => {
    switch (theme) {
      case "light":
        setTheme("dark")
        break
      case "dark":
        setTheme("light")
        break
      default:
        setTheme("light")
        break
    }
  }, [theme, setTheme])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-1 text-primary hover:text-primary"
          onClick={handleThemeChange}
          data-test-id="sidebar:mode-toggle-button"
        >
          <SunIcon className="h-[1.2rem] w-[1.2rem] scale-0 data-[theme=light]:scale-100" data-theme={theme} />
          <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] scale-0 data-[theme=dark]:scale-100" data-theme={theme} />
          <MonitorCogIcon
            className="absolute h-[1.2rem] w-[1.2rem] scale-0 data-[theme=system]:scale-100"
            data-theme={theme}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Toggle Theme</p>
      </TooltipContent>
    </Tooltip>
  )
})
