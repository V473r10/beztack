"use client";

import { useState } from "react";
import { CREATE_COMMAND } from "./links";

const RESET_AFTER_MS = 1800;

type CopyCommandProps = {
  className?: string;
  /** Class of the span that holds the command. */
  commandClassName?: string;
  /** Class of the span that holds the copy label. */
  labelClassName?: string;
  /** Shown before the command, for example a prompt sign. */
  prefix?: React.ReactNode;
  /** Text shown before the command is copied. */
  label?: string;
  /** Text shown after the command is copied. */
  copiedLabel?: string;
};

/** A button that copies `pnpm create beztack`. Each redesign styles it its own way. */
export function CopyCommand({
  className,
  commandClassName,
  labelClassName,
  prefix,
  label = "Copy",
  copiedLabel = "Copied",
}: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CREATE_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), RESET_AFTER_MS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={className} data-copied={copied || undefined} onClick={copy} type="button">
      <span className={commandClassName}>
        {prefix}
        {CREATE_COMMAND}
      </span>
      <span aria-live="polite" className={labelClassName}>
        {copied ? copiedLabel : label}
      </span>
    </button>
  );
}
