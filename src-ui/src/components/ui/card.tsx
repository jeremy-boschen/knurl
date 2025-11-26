import type { HTMLAttributes } from "react"

import { cn } from "@/lib"

type DivProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: DivProps) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("p-6 pt-0", className)} {...props} />
}
