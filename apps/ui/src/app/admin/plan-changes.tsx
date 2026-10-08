import { IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type FailedPlanChange,
  useFailedPlanChanges,
  useRetryFailedPlanChange,
} from "@/hooks/use-failed-plan-changes";
import { formatDate, formatPrice } from "@/lib/format";
import { AdminHeader } from "./components/shared/admin-header";

const DIRECTION_LABEL: Record<FailedPlanChange["direction"], string> = {
  downgrade: "Downgrade",
  cadence_change: "Cadence change",
};

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

type FailedPlanChangesViewProps = {
  changes: FailedPlanChange[] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** Asks to retry one change; the page confirms before calling the API. */
  onRetry?: (change: FailedPlanChange) => void;
  /** The change whose retry is in flight, so its button shows it. */
  retryingId?: string | null;
};

/** The table on its own, so tests render it without a query client. */
export function FailedPlanChangesView({
  changes,
  isLoading,
  error,
  onRetry,
  retryingId,
}: FailedPlanChangesViewProps) {
  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading failed plan changes…</p>;
  }
  if (error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Could not load failed plan changes: {error.message}
      </p>
    );
  }
  if (!changes?.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No failed plan changes. Every accepted change activated.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Membership</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>Last error</TableHead>
          <TableHead className="text-right">Attempts</TableHead>
          <TableHead>Failed</TableHead>
          <TableHead>Accepted by</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {changes.map((change) => {
          const plan = change.targetPlanSnapshot;
          return (
            <TableRow key={change.id}>
              <TableCell>
                <div className="font-medium">
                  {change.membershipTargetName ?? change.membershipTarget.id}
                </div>
                <div className="text-muted-foreground text-xs">
                  {change.membershipTarget.type} · subscription {change.subscriptionId}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{DIRECTION_LABEL[change.direction]}</Badge>
                <div className="mt-1 text-sm">
                  {plan.canonicalTierId} · {plan.billingCadence} ·{" "}
                  {formatPrice(plan.price.amount, plan.price.currency)}
                </div>
                <div className="text-muted-foreground text-xs">{plan.paymentProvider}</div>
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal break-words text-sm">
                {change.reason ?? "No error recorded"}
              </TableCell>
              <TableCell className="text-right">
                {change.activationAttempts}
                {change.retriedAt && (
                  <div className="text-muted-foreground text-xs">
                    Last retried by {change.retriedByEmail ?? "a deleted admin"} on{" "}
                    {formatDate(change.retriedAt, DATE_TIME)}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {change.failedAt ? formatDate(change.failedAt, DATE_TIME) : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {change.acceptedByEmail ?? "Reconciled from the provider"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  disabled={!onRetry || Boolean(retryingId)}
                  onClick={() => onRetry?.(change)}
                  size="sm"
                  variant="outline"
                >
                  {retryingId === change.id ? "Retrying…" : "Retry now"}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function FailedPlanChangesPage() {
  const { data, isLoading, error, refetch, isFetching } = useFailedPlanChanges();
  const retry = useRetryFailedPlanChange();
  const [confirming, setConfirming] = useState<FailedPlanChange | null>(null);

  const runRetry = (change: FailedPlanChange) => {
    setConfirming(null);
    retry.mutate(change.id, {
      onSuccess: (result) => {
        if (result.action === "activated") {
          toast.success("Plan change activated");
          return;
        }
        toast.error(
          `Plan change still failed: ${result.pendingPlanChange?.reason ?? "unknown error"}`,
        );
      },
      onError: (retryError) => toast.error(`Could not retry: ${retryError.message}`),
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminHeader
        action={
          <Button disabled={isFetching} onClick={() => refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
        description="Pending Plan changes whose activation kept failing"
        title="Failed Plan Changes"
      />
      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            After repeated failed webhook deliveries a change stops retrying and the Membership
            keeps its current plan. Fix the cause with the payment provider, then retry it here: the
            provider is told to charge the target plan from the next charge and the Membership moves
            to it right away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FailedPlanChangesView
            changes={data}
            error={error}
            isLoading={isLoading}
            onRetry={setConfirming}
            retryingId={retry.isPending ? retry.variables : null}
          />
        </CardContent>
      </Card>
      <AlertDialog onOpenChange={(open) => !open && setConfirming(null)} open={Boolean(confirming)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry this plan change now?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.membershipTargetName ?? confirming?.membershipTarget.id} moves to{" "}
              {confirming?.targetPlanSnapshot.canonicalTierId} immediately, and{" "}
              {confirming?.targetPlanSnapshot.paymentProvider} charges that plan from the next
              charge. If it fails again it stays in this list with the new error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && runRetry(confirming)}>
              Retry now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
