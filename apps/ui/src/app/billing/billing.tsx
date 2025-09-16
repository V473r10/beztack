import { AlertCircle } from "lucide-react";
import { BillingDashboard } from "@/components/payments/billing-dashboard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMembership } from "@/contexts/membership-context";

const SKELETON_ITEMS = 3;
const SKELETON_ITEMS_COUNT = Array.from(
  { length: SKELETON_ITEMS },
  (_, i) => i + 1
);

export default function Billing() {
  const {
    subscriptions,
    orders,
    meters,
    currentTier,
    tierConfig,
    isLoading,
    error,
    upgradeToTier,
    openBillingPortal,
  } = useMembership();

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load billing information. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || !tierConfig) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>

          {/* Main Content Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Metrics Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {SKELETON_ITEMS_COUNT.map((i) => (
                  <div className="space-y-2" key={i}>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleUpgrade = async (
    tierId: string,
    billingPeriod: "monthly" | "yearly"
  ) => {
    try {
      await upgradeToTier(tierId, billingPeriod);
    } catch {
      // Error is handled by the upgradeToTier function's internal error handling
    }
  };

  const handleManageBilling = async () => {
    try {
      await openBillingPortal(window.location.href);
    } catch {
      // Error is handled by the openBillingPortal function's internal error handling
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and access billing history.
        </p>
      </div>

      {/* Main Dashboard */}
      <BillingDashboard
        currentTier={currentTier}
        isLoading={isLoading}
        meters={meters}
        onManageBilling={handleManageBilling}
        onUpgrade={handleUpgrade}
        orders={orders}
        subscriptions={subscriptions}
        tierConfig={tierConfig}
      />
    </div>
  );
}
