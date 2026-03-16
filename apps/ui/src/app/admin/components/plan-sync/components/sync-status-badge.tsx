import { AlertTriangle, Check, Cloud, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SyncStatus } from "../types";

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  // biome-ignore lint/nursery/noUnnecessaryConditions: Exhaustive switch for type safety
  switch (status) {
    case "synced":
      return (
        <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          Synced
        </Badge>
      );
    case "local-only":
      return (
        <Badge className="gap-1 bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:bg-blue-500/10 dark:text-blue-400">
          <Database className="h-3 w-3" />
          Local Only
        </Badge>
      );
    case "remote-only":
      return (
        <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
          <Cloud className="h-3 w-3" />
          Remote Only
        </Badge>
      );
    case "out-of-sync":
      return (
        <Badge className="gap-1 bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          Out of Sync
        </Badge>
      );
    default:
      return null;
  }
}
