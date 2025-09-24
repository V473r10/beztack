import { CheckCircle, CreditCard, Home } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MembershipBadge } from "@/components/payments/membership-badge";
import { formatCurrency } from "@/components/payments/pricing-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMembership } from "@/contexts/membership-context";
import type { MembershipTier } from "@/types/membership";

const MAX_FEATURES_DISPLAY = 6;

const formatLimitValue = (key: string, value: number): string => {
  if (value === -1) {
    return "Unlimited";
  }

  if (key === "storage") {
    return `${value}GB`;
  }

  if (key === "apiCalls") {
    return `${value.toLocaleString()}/mo`;
  }

  return value.toLocaleString();
};

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshMembership, activeSubscription, tierConfig } = useMembership();

  // Get tier from URL params (Polar checkout should include this)
  const tier = (searchParams.get("tier") as MembershipTier) || "pro";
  const sessionId = searchParams.get("session_id");
  const organizationId = searchParams.get("organization_id");

  // Tier config is now available through membership context

  // Refresh membership data when component mounts
  useEffect(() => {
    refreshMembership();
  }, [refreshMembership]);

  const handleGoToDashboard = () => {
    navigate("/");
  };

  const handleGoToBilling = () => {
    navigate("/billing");
  };

  if (!tierConfig) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Invalid tier information. Please contact support.
            </p>
            <Button className="mt-4" onClick={handleGoToDashboard}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Success Header */}
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
          <CardContent className="py-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <h1 className="mb-2 font-bold text-2xl">Payment Successful!</h1>
            <p className="mb-6 text-muted-foreground">
              Welcome to your new {tierConfig.name} plan. Your upgrade is now
              active.
            </p>

            <MembershipBadge size="lg" tier={tier} />
          </CardContent>
        </Card>

        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan Details
            </CardTitle>
            <CardDescription>
              Your subscription has been activated
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-muted-foreground text-sm">Plan</div>
                <div className="font-medium">
                  {tierConfig?.name ||
                    tier.charAt(0).toUpperCase() + tier.slice(1)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground text-sm">Price</div>
                <div className="font-medium">
                  {activeSubscription?.metadata?.tier ? (
                    <>
                      {/* Price info now from membership context */}
                      Active subscription
                    </>
                  ) : (
                    `${formatCurrency(tierConfig?.price?.monthly || 0)} / month`
                  )}
                </div>
              </div>
              {activeSubscription && (
                <>
                  <div className="space-y-1">
                    <div className="text-muted-foreground text-sm">
                      Next billing
                    </div>
                    <div className="font-medium">
                      {activeSubscription.currentPeriodEnd
                        ? new Date(
                            activeSubscription.currentPeriodEnd
                          ).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="font-medium">
                      What's included in your plan:
                    </div>
                    {tierConfig?.features?.map((feature: string) => (
                      <div className="flex items-center gap-2" key={feature}>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    )) || (
                      <div className="text-muted-foreground text-sm">
                        Loading plan features...
                      </div>
                    )}
                  </div>
                </>
              )}
              {tierConfig?.limits && (
                <div className="space-y-3">
                  <div className="font-medium">Plan limits:</div>
                  {Object.entries(tierConfig.limits).map(
                    ([key, value]: [string, number]) => (
                      <div
                        className="flex items-center justify-between"
                        key={key}
                      >
                        <span className="text-muted-foreground text-sm">
                          {key}:
                        </span>
                        <span className="font-medium text-sm">
                          {value === -1 ? "Unlimited" : value}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
              {tierConfig && (
                <div className="border-t pt-4">
                  <div className="text-muted-foreground text-sm">
                    Enjoy all the features of your {tierConfig.name} plan!
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Features */}
            <div className="space-y-3">
              <div className="font-medium">What's included:</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {tierConfig.features
                  .slice(0, MAX_FEATURES_DISPLAY)
                  .map((feature) => (
                    <div
                      className="flex items-center gap-2 text-sm"
                      key={feature}
                    >
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      {feature}
                    </div>
                  ))}
                {tierConfig.features.length > MAX_FEATURES_DISPLAY && (
                  <div className="col-span-full text-muted-foreground text-sm">
                    And {tierConfig.features.length - MAX_FEATURES_DISPLAY} more
                    features...
                  </div>
                )}
              </div>
            </div>

            {/* Usage Limits */}
            {tierConfig.limits && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="font-medium">Usage limits:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(tierConfig.limits).map(([key, value]) => (
                      <div className="flex justify-between" key={key}>
                        <span className="text-muted-foreground">
                          {key.charAt(0).toUpperCase() +
                            key.slice(1).replace(/([A-Z])/g, " $1")}
                          :
                        </span>
                        <span className="font-medium">
                          {formatLimitValue(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Session Information (for debugging/support) */}
        {sessionId && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Session ID:</span>
                <span className="font-mono text-xs">{sessionId}</span>
              </div>
              {organizationId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Organization:</span>
                  <span className="font-mono text-xs">{organizationId}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            className="flex-1 sm:flex-none"
            onClick={handleGoToDashboard}
            size="lg"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={handleGoToBilling}
            size="lg"
            variant="outline"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Billing
          </Button>
        </div>

        {/* Next Steps */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="py-6">
            <h3 className="mb-3 font-semibold text-blue-900 dark:text-blue-100">
              What's next?
            </h3>
            <div className="space-y-2 text-blue-800 text-sm dark:text-blue-200">
              <p>• Explore your new features in the dashboard</p>
              <p>• Set up your team and organization settings</p>
              <p>• Configure API access and integrations</p>
              <p>• Check out the advanced security features</p>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <div className="text-center text-muted-foreground text-sm">
          Have questions? Check out our{" "}
          <Button className="h-auto p-0" variant="link">
            documentation
          </Button>{" "}
          or{" "}
          <Button className="h-auto p-0" variant="link">
            contact support
          </Button>
          .
        </div>
      </div>
    </div>
  );
}
