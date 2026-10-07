import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { useActiveOrganization } from "@/hooks/use-organizations";
import {
  type PendingPlanChange,
  useCancelPendingPlanChange,
  usePendingPlanChange,
} from "@/hooks/use-pending-plan-change";
import { formatDate, formatPrice } from "@/lib/format";

type PendingPlanChangeNoticeViewProps = {
  pendingPlanChange: PendingPlanChange;
  isCanceling: boolean;
  onCancel: () => void;
};

/** What changes at renewal, when, and a way to keep the current terms. */
export function PendingPlanChangeNoticeView({
  pendingPlanChange,
  isCanceling,
  onCancel,
}: PendingPlanChangeNoticeViewProps) {
  const { t } = useTranslation();
  const { targetPlan } = pendingPlanChange;
  const values = {
    tier: targetPlan.tierId.charAt(0).toUpperCase() + targetPlan.tierId.slice(1),
    cadence: t(`billing.${targetPlan.billingCadence}`),
    price: formatPrice(targetPlan.price.amount, targetPlan.price.currency),
  };

  return (
    <Alert className="mb-6">
      <CalendarClock className="h-4 w-4" />
      <AlertTitle>{t("billing.pendingPlanChange.title")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {pendingPlanChange.effectiveAt
            ? t(`billing.pendingPlanChange.${pendingPlanChange.direction}On`, {
                ...values,
                date: formatDate(pendingPlanChange.effectiveAt, { dateStyle: "long" }),
              })
            : t(`billing.pendingPlanChange.${pendingPlanChange.direction}AtRenewal`, values)}
        </span>
        <Button disabled={isCanceling} onClick={onCancel} size="sm" variant="outline">
          {t("billing.pendingPlanChange.cancel")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Shows the Membership target's Pending Plan change, if any. */
export function PendingPlanChangeNotice() {
  const { t } = useTranslation();
  const { data: activeOrganization } = useActiveOrganization();
  const organizationId =
    env.VITE_SUBSCRIPTION_MODE === "organization" ? activeOrganization?.id : undefined;
  const { data: pendingPlanChange } = usePendingPlanChange(
    organizationId,
    env.VITE_SUBSCRIPTION_MODE !== "organization" || Boolean(organizationId),
  );
  const cancel = useCancelPendingPlanChange(organizationId);

  if (!pendingPlanChange) {
    return null;
  }

  return (
    <PendingPlanChangeNoticeView
      isCanceling={cancel.isPending}
      onCancel={() =>
        cancel.mutate(undefined, {
          onSuccess: () => toast.success(t("billing.pendingPlanChange.canceled")),
          onError: () => toast.error(t("billing.pendingPlanChange.cancelFailed")),
        })
      }
      pendingPlanChange={pendingPlanChange}
    />
  );
}
