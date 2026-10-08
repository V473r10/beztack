import { IconRefresh } from "@tabler/icons-react";
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
import { type FailedPlanChange, useFailedPlanChanges } from "@/hooks/use-failed-plan-changes";
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
};

/** The table on its own, so tests render it without a query client. */
export function FailedPlanChangesView({ changes, isLoading, error }: FailedPlanChangesViewProps) {
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
              <TableCell className="text-right">{change.activationAttempts}</TableCell>
              <TableCell className="text-sm">
                {change.failedAt ? formatDate(change.failedAt, DATE_TIME) : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {change.acceptedByEmail ?? "Reconciled from the provider"}
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
            keeps its current plan. Fix the cause with the payment provider, then the Billing
            manager can request the change again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FailedPlanChangesView changes={data} error={error} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
