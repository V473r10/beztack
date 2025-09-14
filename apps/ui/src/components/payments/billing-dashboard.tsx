import { formatCurrency, getBillingPortalUrl } from "@nvn/payments/client";
// Tier configurations now fetched dynamically from API
import type {
  CustomerMeter,
  MembershipTier,
  MembershipTierConfig,
  Order,
  Subscription,
} from "@nvn/payments/types";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  Receipt,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MembershipBadge, MembershipStatus } from "./membership-badge";
import { UpgradeDialog } from "./upgrade-dialog";
import { UsageMetrics } from "./usage-metrics";

export type BillingDashboardProps = {
  subscriptions?: Subscription[];
  orders?: Order[];
  meters?: CustomerMeter[];
  currentTier: MembershipTier;
  tierConfig: MembershipTierConfig;
  onUpgrade?: (tierId: string, billingPeriod: "monthly" | "yearly") => void;
  onManageBilling?: () => void;
  isLoading?: boolean;
  className?: string;
};

type SubscriptionCardProps = {
  subscription: Subscription;
  onManage?: () => void;
  onUpgrade?: () => void;
};

function SubscriptionCard({
  subscription,
  onManage,
  onUpgrade,
}: SubscriptionCardProps) {
  const isActive = subscription.status === "active";
  const isCanceled = subscription.status === "canceled";
  const inGracePeriod =
    isCanceled &&
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) > new Date();

  const getStatusColor = () => {
    if (isActive) {
      return "default";
    }
    if (inGracePeriod) {
      return "secondary";
    }
    return "destructive";
  };

  const getStatusText = () => {
    if (isActive) {
      return "Active";
    }
    if (inGracePeriod && subscription.currentPeriodEnd) {
      return (
        "Canceled (Active until " +
        new Date(subscription.currentPeriodEnd).toLocaleDateString() +
        ")"
      );
    }
    return "Canceled";
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {subscription.metadata?.tier
                ? `${subscription.metadata.tier.charAt(0).toUpperCase() + subscription.metadata.tier.slice(1)} Plan`
                : "Subscription"}
            </CardTitle>
            <CardDescription>
              {subscription.metadata?.tier
                ? // Price information should be fetched from tier API or subscription data
                  "Active subscription"
                : "Unknown subscription"}
            </CardDescription>
          </div>
          <Badge
            variant={
              getStatusColor() as
                | "default"
                | "secondary"
                | "destructive"
                | "outline"
            }
          >
            {getStatusText()}
          </Badge>
        </div>

        {inGracePeriod && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Your subscription is canceled but remains active until{" "}
              {subscription.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                : "N/A"}
              . You can reactivate it anytime before then.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Next billing</div>
            <div className="font-medium">
              {isActive && subscription.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Started</div>
            <div className="font-medium">
              {subscription.createdAt
                ? new Date(subscription.createdAt).toLocaleDateString()
                : "—"}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          {onManage && (
            <Button
              className="flex-1"
              onClick={onManage}
              size="sm"
              variant="outline"
            >
              <Settings className="mr-1 h-3 w-3" />
              Manage
            </Button>
          )}
          {onUpgrade && (isActive || inGracePeriod) && (
            <Button className="flex-1" onClick={onUpgrade} size="sm">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              Upgrade
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type OrderHistoryProps = {
  orders: Order[];
};

// Helper function to get badge variant based on order status
function getOrderStatusVariant(status: string) {
  if (status === "completed") {
    return "default";
  }
  if (status === "pending") {
    return "secondary";
  }
  return "destructive";
}

// Helper function to get status icon
function getStatusIcon(status: string) {
  if (status === "completed") {
    return <CheckCircle className="h-4 w-4" />;
  }
  if (status === "pending") {
    return <Clock className="h-4 w-4" />;
  }
  if (status === "canceled" || status === "refunded") {
    return <AlertCircle className="h-4 w-4" />;
  }
  return null;
}

// Helper function to get status styling classes
function getStatusClasses(status: string) {
  const baseClasses = "flex h-8 w-8 items-center justify-center rounded-full";

  if (status === "completed") {
    return `${baseClasses} bg-green-100 text-green-600 dark:bg-green-900/20`;
  }
  if (status === "pending") {
    return `${baseClasses} bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20`;
  }
  if (status === "canceled" || status === "refunded") {
    return `${baseClasses} bg-red-100 text-red-600 dark:bg-red-900/20`;
  }
  return baseClasses;
}

function OrderHistory({ orders }: OrderHistoryProps) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Receipt className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No orders found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className={getStatusClasses(order.status)}>
                {getStatusIcon(order.status)}
              </div>

              <div className="space-y-1">
                <div className="font-medium">
                  {order.metadata?.tier
                    ? `${order.metadata.tier.charAt(0).toUpperCase() + order.metadata.tier.slice(1)} Plan`
                    : "Order"}
                </div>
                <div className="text-muted-foreground text-sm">
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString()
                    : "N/A"}{" "}
                  • {formatCurrency(order.amount)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={getOrderStatusVariant(order.status)}>
                {(order.status || "unknown").charAt(0).toUpperCase() +
                  (order.status || "unknown").slice(1)}
              </Badge>
              <Button size="sm" variant="ghost">
                <Eye className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost">
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BillingDashboard({
  subscriptions = [],
  orders = [],
  meters = [],
  currentTier,
  tierConfig,
  onUpgrade,
  onManageBilling,
  isLoading = false,
  className,
}: BillingDashboardProps) {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const activeSubscription = subscriptions.find(
    (sub) =>
      sub.status === "active" ||
      (sub.status === "canceled" &&
        sub.currentPeriodEnd &&
        new Date(sub.currentPeriodEnd) > new Date())
  );

  const handleUpgrade = (
    tierId: string,
    billingPeriod: "monthly" | "yearly"
  ) => {
    onUpgrade?.(tierId, billingPeriod);
    setShowUpgradeDialog(false);
  };

  const handleManageBilling = () => {
    if (onManageBilling) {
      onManageBilling();
    } else {
      // Fallback to Polar billing portal
      window.open(getBillingPortalUrl(), "_blank");
    }
  };

  return (
    <>
      <div className={cn("space-y-6", className)}>
        {/* Current Plan Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>
                  Manage your subscription and billing preferences
                </CardDescription>
              </div>
              <MembershipBadge size="lg" tier={currentTier} />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeSubscription ? (
              <MembershipStatus
                expiresAt={
                  activeSubscription.currentPeriodEnd
                    ? new Date(activeSubscription.currentPeriodEnd)
                    : undefined
                }
                isActive={activeSubscription.status === "active"}
                tier={currentTier}
              />
            ) : (
              <div className="text-muted-foreground text-sm">
                No active subscription
              </div>
            )}

            <div className="flex gap-2">
              <Button
                disabled={isLoading}
                onClick={handleManageBilling}
                variant="outline"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
              {currentTier !== "enterprise" && (
                <Button
                  disabled={isLoading}
                  onClick={() => setShowUpgradeDialog(true)}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Upgrade Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed views */}
        <Tabs className="space-y-4" defaultValue="usage">
          <TabsList>
            <TabsTrigger value="usage">Usage & Limits</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="orders">Order History</TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <UsageMetrics
              meters={meters}
              onUpgrade={() => setShowUpgradeDialog(true)}
              tierConfig={tierConfig}
            />
          </TabsContent>

          <TabsContent className="space-y-4" value="subscriptions">
            {subscriptions.length > 0 ? (
              subscriptions.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  onManage={handleManageBilling}
                  onUpgrade={() => setShowUpgradeDialog(true)}
                  subscription={subscription}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <CreditCard className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="mb-4 text-muted-foreground text-sm">
                    No active subscriptions
                  </p>
                  <Button onClick={() => setShowUpgradeDialog(true)}>
                    Choose a Plan
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="orders">
            <OrderHistory orders={orders} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Upgrade Dialog */}
      <UpgradeDialog
        currentTier={currentTier}
        isLoading={isLoading}
        onOpenChange={setShowUpgradeDialog}
        onUpgrade={handleUpgrade}
        open={showUpgradeDialog}
        suggestedTier="pro"
      />
    </>
  );
}
