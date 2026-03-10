import { AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMembership } from "@/contexts/membership-context";

function formatDate(date: Date | string | undefined, locale: string): string {
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function InactiveSubscriptionBanner() {
  const { t, i18n } = useTranslation();
  const { activeSubscription, currentTier } = useMembership();

  if (!activeSubscription || currentTier === "free") {
    return null;
  }

  const { status, currentPeriodEnd } = activeSubscription;
  const isActive = status === "active";

  if (isActive) {
    return null;
  }

  const dateStr = formatDate(currentPeriodEnd, i18n.language);

  const statusMessageMap: Record<string, string> = {
    canceled: "billing.inactive.canceled",
    paused: "billing.inactive.paused",
    past_due: "billing.inactive.pastDue",
  };
  const messageKey = statusMessageMap[status] ?? "billing.inactive.expired";

  return (
    <Alert className="mb-4" variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t("billing.inactive.title")}</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{t(messageKey, { date: dateStr })}</p>
        <div className="flex gap-2">
          {status === "past_due" ? (
            <Button asChild size="sm" type="button" variant="outline">
              <Link to="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                {t("billing.inactive.reactivate")}
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" type="button" variant="outline">
              <Link to="/pricing">
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("billing.inactive.viewPlans")}
              </Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
