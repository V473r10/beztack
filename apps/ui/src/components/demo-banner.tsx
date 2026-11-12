import { FlaskConical } from "lucide-react";
import { env } from "@/env";

/**
 * Tells visitors of the public live demo (docs/demo.md) that payments are
 * sandbox only and the data is wiped. Pinned to the bottom edge so it never
 * moves the layout or collides with the Admin tier override banner on top.
 */
export function DemoBanner() {
  if (!env.VITE_DEMO_MODE) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-2"
      role="status"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300/70 bg-zinc-950/95 px-4 py-1.5 text-sm text-zinc-50 shadow-lg backdrop-blur-md dark:border-amber-400/30">
        <FlaskConical className="size-4 shrink-0 text-amber-300" />
        <span>
          <span className="font-semibold text-amber-200">Demo:</span> sandbox payments, data resets
          daily
        </span>
      </div>
    </div>
  );
}
