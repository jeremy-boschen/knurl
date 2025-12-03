import { useEffect } from "react"

import { MainWindow } from "@/components/windows/main"
import { warmPrettier } from "@/lib/prettier"

function App() {
  console.log('[App] render')
  useEffect(() => {
    console.log('[App] useEffect - warming prettier')
    warmPrettier()
  }, [])

  return <MainWindow data-test-id="app:main-window" />
}

export default App
