/**
 * Subscription Welcome Page
 * Displays a welcome message after Mercado Pago subscription checkout
 * Uses the app's global theme system
 */
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CreditCard,
  Home,
  Loader2,
  LogIn,
  Receipt,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatAmount,
  type SubscriptionDetails,
  useSubscriptionDetails,
} from "@/hooks/use-subscription-details";
import { authClient } from "@/lib/auth-client";
import { formatDate, formatRelativeFromNow } from "@/lib/format";

const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;

function frequencyLabel(
  frequency: number,
  frequencyType: SubscriptionDetails["price"]["frequencyType"],
  t: TFunction,
): string {
  if (frequencyType === "months") {
    if (frequency === 1) {
      return t("billing.welcome.frequency.monthly");
    }
    if (frequency === MONTHS_PER_YEAR) {
      return t("billing.welcome.frequency.yearly");
    }
    return t("billing.welcome.frequency.everyMonths", { count: frequency });
  }
  if (frequency === 1) {
    return t("billing.welcome.frequency.daily");
  }
  if (frequency === DAYS_PER_WEEK) {
    return t("billing.welcome.frequency.weekly");
  }
  return t("billing.welcome.frequency.everyDays", { count: frequency });
}

/**
 * Loading state component
 */
function LoadingSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center px-4 py-16">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("billing.welcome.loading")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({
  error,
  onRetry,
  onGoHome,
}: {
  error: Error;
  onRetry: () => void;
  onGoHome: () => void;
}) {
  const { t } = useTranslation();
  const errorMessages: Record<string, { title: string; description: string }> = {
    SUBSCRIPTION_NOT_FOUND: {
      title: t("billing.welcome.errors.notFoundTitle"),
      description: t("billing.welcome.errors.notFoundDescription"),
    },
    SUBSCRIPTION_ACCESS_DENIED: {
      title: t("billing.welcome.errors.accessDeniedTitle"),
      description: t("billing.welcome.errors.accessDeniedDescription"),
    },
    SUBSCRIPTION_ID_REQUIRED: {
      title: t("billing.welcome.errors.idRequiredTitle"),
      description: t("billing.welcome.errors.idRequiredDescription"),
    },
    SUBSCRIPTION_FETCH_ERROR: {
      title: t("billing.welcome.errors.fetchTitle"),
      description: t("billing.welcome.errors.fetchDescription"),
    },
  };

  const errorInfo = errorMessages[error.message] || {
    title: t("billing.welcome.errors.unexpectedTitle"),
    description: t("billing.welcome.errors.unexpectedDescription"),
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] max-w-md items-center justify-center px-4 py-16">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle>{errorInfo.title}</CardTitle>
          <CardDescription>{errorInfo.description}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          {error.message === "SUBSCRIPTION_FETCH_ERROR" && (
            <Button className="w-full gap-2" onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4" />
              {t("billing.welcome.retry")}
            </Button>
          )}
          <Button className="w-full" onClick={onGoHome}>
            {t("billing.welcome.goHome")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Missing preapproval_id display
 */
function MissingIdDisplay({ onGoHome }: { onGoHome: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto flex min-h-[80vh] max-w-md items-center justify-center px-4 py-16">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>{t("billing.welcome.missingTitle")}</CardTitle>
          <CardDescription>{t("billing.welcome.missingDescription")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={onGoHome}>
            {t("billing.welcome.goHome")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Main subscription welcome page component
 */
export default function SubscriptionWelcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get query parameters
  const preapprovalId = searchParams.get("preapproval_id");

  // Auth state
  const { data: session } = authClient.useSession();
  const isAuthenticated = !!session?.user;
  const userName = session?.user?.name || undefined;

  // Fetch subscription details
  const { data: subscription, isLoading, error, refetch } = useSubscriptionDetails(preapprovalId);

  // Navigation handlers
  const handleNavigateToDashboard = () => navigate("/");
  const handleNavigateToBilling = () => navigate("/billing");
  const handleNavigateToLogin = () => navigate("/auth/sign-in");

  // Handle missing preapproval_id
  if (!preapprovalId) {
    return <MissingIdDisplay onGoHome={handleNavigateToDashboard} />;
  }

  // Handle loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorDisplay error={error} onGoHome={handleNavigateToDashboard} onRetry={() => refetch()} />
    );
  }

  // Handle no data (shouldn't happen if no error)
  if (!subscription) {
    return <LoadingSkeleton />;
  }

  const statusLabel = t(`billing.welcome.status.${subscription.status}`, subscription.status);
  const formattedPrice = formatAmount(subscription.price.amount, subscription.price.currency);
  const formattedFrequency = frequencyLabel(
    subscription.price.frequency,
    subscription.price.frequencyType,
    t,
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="space-y-6">
        {/* Success Header */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>

            <h1 className="mb-2 font-bold text-2xl">
              {isAuthenticated && userName
                ? t("billing.welcome.greeting", { name: userName.split(" ")[0] })
                : t("billing.welcome.success")}
            </h1>

            <p className="mb-4 text-muted-foreground">{t("billing.welcome.activated")}</p>

            <Badge className="gap-1">
              <Sparkles className="h-3 w-3" />
              {statusLabel}
            </Badge>
          </CardContent>
        </Card>

        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t("billing.welcome.planDetails")}
            </CardTitle>
            <CardDescription>{t("billing.welcome.planInfo")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Plan name and price */}
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="mb-1 text-muted-foreground text-sm">{t("billing.welcome.yourPlan")}</p>
              <h2 className="mb-2 font-semibold text-xl">{subscription.plan.name}</h2>
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-bold text-3xl text-primary">{formattedPrice}</span>
                <span className="text-muted-foreground">/ {formattedFrequency}</span>
              </div>
            </div>

            <Separator />

            {/* Info grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {subscription.dates.nextPayment && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("billing.welcome.nextPayment")}
                    </p>
                    <p className="font-medium">
                      {formatDate(subscription.dates.nextPayment, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeFromNow(subscription.dates.nextPayment)}
                    </p>
                  </div>
                </div>
              )}

              {subscription.paymentMethod && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("billing.welcome.paymentMethod")}
                    </p>
                    <p className="font-medium capitalize">
                      {subscription.paymentMethod.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            {isAuthenticated ? (
              <>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToDashboard}
                  size="lg"
                >
                  <Home className="h-4 w-4" />
                  {t("billing.welcome.goToDashboard")}
                </Button>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToBilling}
                  size="lg"
                  variant="outline"
                >
                  <Receipt className="h-4 w-4" />
                  {t("billing.welcome.manageSubscription")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToLogin}
                  size="lg"
                >
                  <LogIn className="h-4 w-4" />
                  {t("billing.welcome.signIn")}
                </Button>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToDashboard}
                  size="lg"
                  variant="outline"
                >
                  <Home className="h-4 w-4" />
                  {t("billing.welcome.goHome")}
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        {/* Reference ID */}
        <div className="text-center">
          <p className="font-mono text-muted-foreground text-xs">
            {t("billing.welcome.reference", { id: subscription.id })}
          </p>
        </div>
      </div>
    </div>
  );
}
