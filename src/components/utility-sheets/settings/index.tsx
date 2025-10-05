import { useState } from "react"

import { DatabaseIcon, InfoIcon, PaletteIcon, SettingsIcon } from "lucide-react"

import AboutSection from "./sections/about"
import AppearanceSection from "./sections/appearance"
import DataSection from "./sections/data/data"
import RequestsSection from "./sections/requests"
import { Button } from "@/components/ui/button"
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

// --- Component ---

export default function SettingsSheet() {
  const [section, setSection] = useState<"appearance" | "requests" | "data" | "about">("appearance")
  const sections = [
    { key: "appearance" as const, label: "Appearance", icon: <PaletteIcon className="mr-1 h-4 w-4" /> },
    { key: "requests" as const, label: "Requests", icon: <SettingsIcon className="mr-1 h-4 w-4" /> },
    { key: "data" as const, label: "Data", icon: <DatabaseIcon className="mr-1 h-4 w-4" /> },
    { key: "about" as const, label: "About", icon: <InfoIcon className="mr-1 h-4 w-4" /> },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SheetHeader className="border-b px-6 pt-6 pb-3">
        <SheetTitle className="flex items-center gap-2 text-xl">
          <SettingsIcon className="h-5 w-5" />
          Application Settings
        </SheetTitle>
        <SheetDescription>Configure global application preferences and behavior.</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col overflow-hidden">
        <nav className="flex flex-wrap gap-2 border-b px-6 py-4" aria-label="Settings sections">
          {sections.map((s) => (
            <Button
              key={s.key}
              variant={section === s.key ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setSection(s.key)}
              aria-pressed={section === s.key}
              size="sm"
            >
              {s.icon}
              {s.label}
            </Button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {section === "appearance" && <AppearanceSection />}
          {section === "requests" && <RequestsSection />}
          {section === "data" && <DataSection />}
          {section === "about" && <AboutSection />}
        </div>
      </div>
    </div>
  )
}
