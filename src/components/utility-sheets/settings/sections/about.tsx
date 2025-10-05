import React, { useEffect, useState } from "react"

import { SiClaude, SiGithub, SiGooglegemini, SiOpenai } from "@icons-pack/react-simple-icons"
import { getTauriVersion, getVersion } from "@tauri-apps/api/app"
import { BotIcon } from "lucide-react"

import { KnurlIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SettingRow } from "./setting-row"

const contributors = [
  { name: "Jeremy Boschen", url: "https://github.com/jeremy-boschen" },
  { name: "Laura Heckman", url: "https://lauraheckman.art" },
]

const Contributors = ({ people }: { people: { name: string; url: string }[] }) => (
  <div className="text-right">
    {people.map((person, index) => (
      <React.Fragment key={person.name}>
        <a href={person.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {person.name}
        </a>
        {index < people.length - 1 ? ", " : ""}
      </React.Fragment>
    ))}
  </div>
)

export default function AboutSection() {
  const [versions, setVersions] = useState({ app: "...", tauri: "..." })

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const [app, tauri] = await Promise.all([getVersion(), getTauriVersion()])
        setVersions({ app, tauri })
      } catch (error) {
        console.error("Failed to fetch versions:", error)
        setVersions({ app: "unknown", tauri: "unknown" })
      }
    }
    void fetchVersions()
  }, [])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 p-1">
      {/* Logo & version area */}
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex items-center justify-center">
            <KnurlIcon className="h-20 w-20" />
          </div>
          <div className="flex flex-col justify-start items-start">
            <div className="flex items-baseline gap-2">
              <h1 className="text-4xl font-bold tracking-tight text-primary">KNURL</h1>
              <p className="text-sm text-muted-foreground">v{versions.app}</p>
            </div>
            <p className="text-muted-foreground">A cloudless, desktop HTTP client.</p>
          </div>
        </div>
      </div>

      <Separator />

      <SettingRow
        label="Project Repository"
        description="View the source code, report issues, or contribute on GitHub."
      >
        <Button variant="outline" size="sm" asChild>
          <a href="https://github.com/jeremy-boschen/knurl" target="_blank" rel="noopener noreferrer">
            <SiGithub className="mr-2 h-4 w-4" />
            GitHub
          </a>
        </Button>
      </SettingRow>

      <SettingRow label="Contributors" description="Special thanks to everyone who has contributed.">
        <Contributors people={contributors} />
      </SettingRow>

      <SettingRow label="Licenses & Notices" description="View the AGPLv3 license and third‑party notices.">
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/jeremy-boschen/knurl/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              License
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/jeremy-boschen/knurl/blob/main/THIRD_PARTY_NOTICES.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Third‑Party Notices
            </a>
          </Button>
        </div>
      </SettingRow>

      <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground pt-8">
        <p>Crafted with</p>
        <BotIcon className="h-4 w-4" />
        <SiOpenai className="h-4 w-4" />
        <SiGooglegemini className="h-4 w-4" />
        <SiClaude className="h-4 w-4" />
      </div>
    </div>
  )
}
