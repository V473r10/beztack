import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Home, CreditCard } from "lucide-react";
import { MembershipBadge } from "@/components/payments/membership-badge";
import { useMembership } from "@/contexts/membership-context";
import { getTierConfig } from "@nvn/payments/constants";
import { formatCurrency } from "@nvn/payments/client";
import type { MembershipTier } from "@nvn/payments/types";

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshMembership, activeSubscription } = useMembership();
  
  // Get tier from URL params (Polar checkout should include this)
  const tier = searchParams.get("tier") as MembershipTier || "pro";
  const sessionId = searchParams.get("session_id");
  const organizationId = searchParams.get("organization_id");
  
  const tierConfig = getTierConfig(tier);

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
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Invalid tier information. Please contact support.
            </p>
            <Button onClick={handleGoToDashboard} className="mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Success Header */}
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="text-center py-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6">
              Welcome to your new {tierConfig.name} plan. Your upgrade is now active.
            </p>
            
            <MembershipBadge tier={tier} size="lg" />
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
                <div className="text-sm text-muted-foreground">Plan</div>
                <div className="font-medium">{tierConfig.name}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Price</div>
                <div className="font-medium">
                  {activeSubscription && activeSubscription.metadata?.tier ? (
                    <>
                      {(() => {
                        const tierConfig = getTierConfig(activeSubscription.metadata.tier!);
                        return tierConfig ? `${formatCurrency(tierConfig.price.monthly)} / month` : "Unknown price";
                      })()}
                    </>
                  ) : (
                    `${formatCurrency(tierConfig.price.monthly)} / month`
                  )}
                </div>
              </div>
              {activeSubscription && (
                <>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Next billing</div>
                    <div className="font-medium">
                      {activeSubscription.currentPeriodEnd ? new Date(activeSubscription.currentPeriodEnd).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="font-medium">
                      <Badge variant="default">Active</Badge>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <Separator />
            
            {/* Features */}
            <div className="space-y-3">
              <div className="font-medium">What's included:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tierConfig.features.slice(0, 6).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    {feature}
                  </div>
                ))}
                {tierConfig.features.length > 6 && (
                  <div className="text-sm text-muted-foreground col-span-full">
                    And {tierConfig.features.length - 6} more features...
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
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:
                        </span>
                        <span className="font-medium">
                          {value === -1 ? "Unlimited" : 
                           key === "storage" ? `${value}GB` :
                           key === "apiCalls" ? `${value.toLocaleString()}/mo` :
                           value.toLocaleString()
                          }
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
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={handleGoToDashboard} size="lg" className="flex-1 sm:flex-none">
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
          <Button onClick={handleGoToBilling} variant="outline" size="lg" className="flex-1 sm:flex-none">
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Billing
          </Button>
        </div>

        {/* Next Steps */}
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-6">
            <h3 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">
              What's next?
            </h3>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <p>• Explore your new features in the dashboard</p>
              <p>• Set up your team and organization settings</p>
              <p>• Configure API access and integrations</p>
              <p>• Check out the advanced security features</p>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <div className="text-center text-sm text-muted-foreground">
          Have questions? Check out our{" "}
          <Button variant="link" className="p-0 h-auto">
            documentation
          </Button>{" "}
          or{" "}
          <Button variant="link" className="p-0 h-auto">
            contact support
          </Button>
          .
        </div>
      </div>
    </div>
  );
}