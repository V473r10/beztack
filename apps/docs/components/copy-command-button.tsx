"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyCommandButton() {
  const [copied, setCopied] = useState(false);
  const command = "pnpm create beztack";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex max-w-md items-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3">
      <code className="flex-1 font-mono text-foreground text-sm">
        {command}
      </code>
      <Button
        className="h-8 w-8 p-0 hover:bg-accent/20"
        onClick={handleCopy}
        size="sm"
        variant="ghost"
      >
        {copied ? (
          <Check className="h-4 w-4 text-accent" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="sr-only">Copy command</span>
      </Button>
    </div>
  );
}
