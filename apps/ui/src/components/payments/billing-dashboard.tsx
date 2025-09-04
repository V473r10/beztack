import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  ExternalLink,
  Receipt,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Download,
  Eye,
} from "lucide-react";
import { MembershipBadge, MembershipStatus } from "./membership-badge";
import { UsageMetrics } from "./usage-metrics";
import { UpgradeDialog } from "./upgrade-dialog";
import { formatCurrency, getBillingPortalUrl } from "@nvn/payments/client";
import { getTierConfig } from "@nvn/payments/constants";
import type { 
  Subscription, 
  Order, 
  CustomerMeter, 
  MembershipTierConfig,
  MembershipTier 
} from "@nvn/payments/types";

export interface BillingDashboardProps {
  subscriptions?: Subscription[];
  orders?: Order[];
  meters?: CustomerMeter[];
  currentTier: MembershipTier;
  tierConfig: MembershipTierConfig;
  onUpgrade?: (tierId: string, billingPeriod: "monthly" | "yearly") => void;
  onManageBilling?: () => void;
  isLoading?: boolean;
  className?: string;
}

interface SubscriptionCardProps {
  subscription: Subscription;
  onManage?: () => void;
  onUpgrade?: () => void;
}

function SubscriptionCard({ subscription, onManage, onUpgrade }: SubscriptionCardProps) {
  const isActive = subscription.status === "active";
  const isCanceled = subscription.status === "canceled";
  const inGracePeriod = isCanceled && subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > new Date();
  
  const getStatusColor = () => {
    if (isActive) return "default";
    if (inGracePeriod) return "secondary";
    return "destructive";
  };

  const getStatusText = () => {
    if (isActive) return "Active";
    if (inGracePeriod && subscription.currentPeriodEnd) return "Canceled (Active until " + new Date(subscription.currentPeriodEnd).toLocaleDateString() + ")";
    return "Canceled";
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {subscription.metadata?.tier ? 
                `${subscription.metadata.tier.charAt(0).toUpperCase() + subscription.metadata.tier.slice(1)} Plan` :
                "Subscription"
              }
            </CardTitle>
            <CardDescription>
              {subscription.metadata?.tier ? (
                (() => {
                  const tierConfig = getTierConfig(subscription.metadata.tier);
                  return tierConfig ? `${formatCurrency(tierConfig.price.monthly)} / month` : "Unknown price";
                })()
              ) : "Unknown price"}
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
              Your subscription is canceled but remains active until {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}.
              You can reactivate it anytime before then.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Next billing</div>
            <div className="font-medium">
              {isActive && subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Started</div>
            <div className="font-medium">
              {subscription.createdAt ? new Date(subscription.createdAt).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div className="flex gap-2">
          {onManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManage}
              className="flex-1"
            >
              <Settings className="mr-1 h-3 w-3" />
              Manage
            </Button>
          )}
          {onUpgrade && (isActive || inGracePeriod) && (
            <Button
              size="sm"
              onClick={onUpgrade}
              className="flex-1"
            >
              <ArrowUpRight className="mr-1 h-3 w-3" />
              Upgrade
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface OrderHistoryProps {
  orders: Order[];
}

function OrderHistory({ orders }: OrderHistoryProps) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No orders found</p>
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
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                order.status === "completed" && "bg-green-100 text-green-600 dark:bg-green-900/20",
                order.status === "pending" && "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20",
                (order.status === "canceled" || order.status === "refunded") && "bg-red-100 text-red-600 dark:bg-red-900/20"
              )}>
                {order.status === "completed" && <CheckCircle className="h-4 w-4" />}
                {order.status === "pending" && <Clock className="h-4 w-4" />}
                {(order.status === "canceled" || order.status === "refunded") && <AlertCircle className="h-4 w-4" />}
              </div>
              
              <div className="space-y-1">
                <div className="font-medium">
                  {order.metadata?.tier ? 
                    `${order.metadata.tier.charAt(0).toUpperCase() + order.metadata.tier.slice(1)} Plan` :
                    "Order"
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'} • {formatCurrency(order.amount)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant={order.status === "completed" ? "default" : order.status === "pending" ? "secondary" : "destructive"}
              >
                {(order.status || "unknown").charAt(0).toUpperCase() + (order.status || "unknown").slice(1)}
              </Badge>
              <Button variant="ghost" size="sm">
                <Eye className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm">
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
  
  const activeSubscription = subscriptions.find(sub => 
    sub.status === "active" || (sub.status === "canceled" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date())
  );

  const handleUpgrade = (tierId: string, billingPeriod: "monthly" | "yearly") => {
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
              <MembershipBadge tier={currentTier} size="lg" />
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {activeSubscription ? (
              <MembershipStatus
                tier={currentTier}
                isActive={activeSubscription.status === "active"}
                expiresAt={activeSubscription.currentPeriodEnd ? new Date(activeSubscription.currentPeriodEnd) : undefined}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                No active subscription
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={isLoading}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
              {currentTier !== "enterprise" && (
                <Button
                  onClick={() => setShowUpgradeDialog(true)}
                  disabled={isLoading}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Upgrade Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="usage">Usage & Limits</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="orders">Order History</TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <UsageMetrics
              meters={meters}
              tierConfig={tierConfig}
              onUpgrade={() => setShowUpgradeDialog(true)}
            />
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            {subscriptions.length > 0 ? (
              subscriptions.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  onManage={handleManageBilling}
                  onUpgrade={() => setShowUpgradeDialog(true)}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">
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
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentTier={currentTier}
        onUpgrade={handleUpgrade}
        isLoading={isLoading}
      />
    </>
  );
}