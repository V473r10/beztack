import { useMembership } from "@/contexts/membership-context";
import { BillingDashboard } from "@/components/payments/billing-dashboard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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
              <div className="flex justify-between items-start">
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
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
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

  const handleUpgrade = async (tierId: string, billingPeriod: "monthly" | "yearly") => {
    try {
      await upgradeToTier(tierId, billingPeriod);
    } catch (error) {
      console.error("Failed to upgrade:", error);
    }
  };

  const handleManageBilling = async () => {
    try {
      await openBillingPortal(window.location.href);
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and access billing history.
        </p>
      </div>

      {/* Main Dashboard */}
      <BillingDashboard
        subscriptions={subscriptions}
        orders={orders}
        meters={meters}
        currentTier={currentTier}
        tierConfig={tierConfig}
        onUpgrade={handleUpgrade}
        onManageBilling={handleManageBilling}
        isLoading={isLoading}
      />
    </div>
  );
}