"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"

export function CopyCommandButton() {
  const [copied, setCopied] = useState(false)
  const command = "pnpm create beztack"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 bg-secondary/50 border border-border rounded-lg px-4 py-3 max-w-md">
      <code className="flex-1 font-mono text-sm text-foreground">{command}</code>
      <Button size="sm" variant="ghost" onClick={handleCopy} className="h-8 w-8 p-0 hover:bg-accent/20">
        {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        <span className="sr-only">Copy command</span>
      </Button>
    </div>
  )
}
