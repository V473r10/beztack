import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSyncMutation } from "../hooks";
import type { SyncDiff } from "../types";

export function DiffTable({
  diffs,
  planId,
}: {
  diffs: SyncDiff[];
  planId: string;
}) {
  const syncMutation = useSyncMutation();

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Field</th>
              <th className="px-3 py-2 text-left font-medium">Local Value</th>
              <th className="px-3 py-2 text-left font-medium">Remote Value</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((diff) => (
              <tr className="border-b last:border-0" key={diff.field}>
                <td className="px-3 py-2 font-mono text-xs">{diff.field}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {String(diff.localValue ?? "—")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {String(diff.remoteValue ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button
          className="gap-1.5"
          disabled={syncMutation.isPending}
          onClick={() =>
            syncMutation.mutate({
              planId,
              direction: "push-to-provider",
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUpFromLine className="h-3.5 w-3.5" />
          )}
          Keep Local
        </Button>
        <Button
          className="gap-1.5"
          disabled={syncMutation.isPending}
          onClick={() =>
            syncMutation.mutate({
              planId,
              direction: "pull-from-provider",
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowDownToLine className="h-3.5 w-3.5" />
          )}
          Keep Remote
        </Button>
      </div>
    </div>
  );
}
