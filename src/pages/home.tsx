import { useEffect } from "react"

import AppLayout from "@/components/layout/app-layout"
import { getStartupState, setStartupState } from "@/lib/startup-state"

export default function Home() {
  useEffect(() => {
    if (getStartupState() !== 2) {
      setStartupState(2)
    }
  }, [])

  return <AppLayout />
}
