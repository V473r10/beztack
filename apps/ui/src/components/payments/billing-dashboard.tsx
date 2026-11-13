import { isCurrentSubscription } from "@beztack/payments/subscription";
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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CustomerMeter, Order, Subscription } from "@/contexts/membership-context";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MembershipTier, MembershipTierConfig } from "@/types/membership";
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SubscriptionCard({ subscription, onManage, onUpgrade }: SubscriptionCardProps) {
  const { t } = useTranslation();
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
      return t("billing.dashboard.subscription.statusActive");
    }
    if (inGracePeriod && subscription.currentPeriodEnd) {
      return t("billing.dashboard.subscription.statusCanceledUntil", {
        date: formatDate(subscription.currentPeriodEnd),
      });
    }
    return t("billing.dashboard.subscription.statusCanceled");
  };

  const tierName = subscription.metadata?.tier
    ? t(`membership.tiers.${subscription.metadata.tier}`, {
        defaultValue: capitalize(subscription.metadata.tier.toString()),
      })
    : null;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {tierName
                ? t("billing.dashboard.subscription.planName", { tier: tierName })
                : t("billing.dashboard.subscription.title")}
            </CardTitle>
            <CardDescription>
              {tierName
                ? // Price information should be fetched from tier API or subscription data
                  t("billing.dashboard.subscription.active")
                : t("billing.dashboard.subscription.unknown")}
            </CardDescription>
          </div>
          <Badge variant={getStatusColor() as "default" | "secondary" | "destructive" | "outline"}>
            {getStatusText()}
          </Badge>
        </div>

        {inGracePeriod && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {t("billing.dashboard.subscription.graceNotice", {
                date: subscription.currentPeriodEnd
                  ? formatDate(subscription.currentPeriodEnd)
                  : t("billing.dashboard.notAvailable"),
              })}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">
              {t("billing.dashboard.subscription.nextBilling")}
            </div>
            <div className="font-medium">
              {isActive && subscription.currentPeriodEnd
                ? formatDate(subscription.currentPeriodEnd)
                : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">
              {t("billing.dashboard.subscription.started")}
            </div>
            <div className="font-medium">
              {subscription.createdAt ? formatDate(subscription.createdAt) : "—"}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          {onManage && (
            <Button className="flex-1" onClick={onManage} size="sm" variant="outline">
              <Settings className="mr-1 h-3 w-3" />
              {t("billing.dashboard.subscription.manage")}
            </Button>
          )}
          {onUpgrade && (isActive || inGracePeriod) && (
            <Button className="flex-1" onClick={onUpgrade} size="sm">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              {t("billing.dashboard.subscription.upgrade")}
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

export function OrderHistory({ orders }: OrderHistoryProps) {
  const { t } = useTranslation();

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Receipt className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">{t("billing.dashboard.orders.empty")}</p>
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
              <div className={getStatusClasses(order.status)}>{getStatusIcon(order.status)}</div>

              <div className="space-y-1">
                <div className="font-medium">
                  {order.metadata?.tier
                    ? t("billing.dashboard.subscription.planName", {
                        tier: t(`membership.tiers.${order.metadata.tier}`, {
                          defaultValue: capitalize(order.metadata.tier.toString()),
                        }),
                      })
                    : t("billing.dashboard.orders.order")}
                </div>
                <div className="text-muted-foreground text-sm">
                  {order.createdAt
                    ? formatDate(order.createdAt)
                    : t("billing.dashboard.notAvailable")}{" "}
                  {"•"} {formatPrice(order.totalAmount, order.currency)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={getOrderStatusVariant(order.status)}>
                {t(`billing.dashboard.orders.status.${order.status || "unknown"}`, {
                  defaultValue: capitalize(order.status || "unknown"),
                })}
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
  const { t } = useTranslation();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const activeSubscription = (() => {
    const validSubs = subscriptions.filter((sub) => isCurrentSubscription(sub));

    return validSubs.at(0);
  })();

  const handleUpgrade = (tierId: string, billingPeriod: "monthly" | "yearly") => {
    onUpgrade?.(tierId, billingPeriod);
    setShowUpgradeDialog(false);
  };

  const handleManageBilling = () => {
    if (onManageBilling) {
      onManageBilling();
    } else {
      toast(t("billing.dashboard.manageBillingError"));
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
                <CardTitle>{t("billing.dashboard.currentPlan")}</CardTitle>
                <CardDescription>{t("billing.dashboard.currentPlanDescription")}</CardDescription>
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
                {t("billing.dashboard.noActiveSubscription")}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={isLoading} onClick={handleManageBilling} variant="outline">
                <CreditCard className="mr-2 h-4 w-4" />
                {t("billing.dashboard.manageBilling")}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
              <Button disabled={isLoading} onClick={() => setShowUpgradeDialog(true)}>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {t("billing.dashboard.changePlan")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed views */}
        <Tabs className="space-y-4" defaultValue="usage">
          <TabsList className="h-auto max-w-full flex-wrap justify-start">
            <TabsTrigger value="usage">{t("billing.dashboard.tabs.usage")}</TabsTrigger>
            <TabsTrigger value="subscriptions">
              {t("billing.dashboard.tabs.subscriptions")}
            </TabsTrigger>
            <TabsTrigger value="orders">{t("billing.dashboard.tabs.orders")}</TabsTrigger>
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
                    {t("billing.dashboard.noActiveSubscriptions")}
                  </p>
                  <Button onClick={() => setShowUpgradeDialog(true)}>
                    {t("billing.dashboard.choosePlan")}
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
      />
    </>
  );
}
