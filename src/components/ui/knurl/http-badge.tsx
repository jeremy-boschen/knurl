import type React from "react"

import type { HttpMethod } from "@/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib"

const HttpMethods: Record<HttpMethod, { abbr: string; color: string }> = {
  GET: { abbr: "GET", color: "bg-http-get text-http-get-foreground" },
  POST: { abbr: "POST", color: "bg-http-post text-http-post-foreground" },
  PUT: { abbr: "PUT", color: "bg-http-put text-http-put-foreground" },
  PATCH: { abbr: "PATCH", color: "bg-http-patch text-http-patch-foreground" },
  DELETE: { abbr: "DEL", color: "bg-http-delete text-http-delete-foreground" },
  HEAD: { abbr: "HEAD", color: "bg-http-head text-http-head-foreground" },
  OPTIONS: { abbr: "OPT", color: "bg-http-options text-http-options-foreground" },
  TRACE: { abbr: "TRACE", color: "bg-http-trace text-http-trace-foreground" },
}

export type HttpBadgeProps = {
  method: HttpMethod
}

export function HttpBadge({ method, className, ...props }: HttpBadgeProps & React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      variant="default"
      className={cn(
        "font-mono text-[10px] min-w-6 h-4 rounded-sm px-1 leading-none",
        HttpMethods[method].color,
        className,
      )}
      {...props}
    >
      {HttpMethods[method].abbr}
    </Badge>
  )
}
