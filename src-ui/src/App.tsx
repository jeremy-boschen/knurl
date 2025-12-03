import { useEffect } from "react"

import { MainWindow } from "@/components/windows/main"
import { warmPrettier } from "@/lib/prettier"

function App() {
  useEffect(() => {
    warmPrettier()
  }, [])

  return <MainWindow data-test-id="app:main-window" />
}

export default App
