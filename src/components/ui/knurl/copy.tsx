import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { CheckCircle2Icon, CopyIcon } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"

type CopyToClipboardProps = {
  disabled?: boolean
  content: string | null | undefined
  timeout?: number
}

export function CopyToClipboard({ disabled = false, content, timeout = 2000 }: CopyToClipboardProps) {
  const [copied, setCopied] = useState<boolean>(false)

  const handleCopy = useCallback(async () => {
    if (content) {
      await writeText(content)
      setCopied(true)
      // auto-clear success after a moment
      window.setTimeout(() => setCopied(false), timeout)
    }
  }, [content, timeout])

  return (
    <Tooltip open={copied} delayDuration={0}>
      <TooltipTrigger asChild>
        <Button size="icon" onClick={handleCopy} disabled={disabled || !content} title="Copy to clipboard">
          <CopyIcon className="w-8 h-8" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex">
          <CheckCircle2Icon className="h-4 w-4 mr-2" />
          Copied to clipboard
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
