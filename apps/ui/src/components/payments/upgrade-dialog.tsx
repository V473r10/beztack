import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Clock, Loader2, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMembership } from "@/contexts/membership-context";
import { usePricingTiers } from "@/hooks/use-pricing-tiers";
import { type PlanChangePreview, usePlanChangePreview } from "@/hooks/use-plan-change-preview";
import { cn } from "@/lib/utils";
import type { MembershipTier } from "@/types/membership";
import type { PricingTier } from "@/types/pricing";
import { MembershipBadge } from "./membership-badge";
import { formatCurrency, PricingCard } from "./pricing-card";
import { queryKeys } from "@/lib/query-keys";

// Constants
const MIN_TIERS_FOR_THREE_COLUMN = 3;

type PlanChangeDisplay =
  | {
      direction: "upgrade";
      unusedCredit: number;
      proratedAmount: number;
      fullAmount: number;
      daysRemaining: number;
    }
  | {
      direction: "downgrade";
      daysRemaining: number;
      newAmount: number;
    };

/** Shapes the server's Plan change preview for display, without recomputing it. */
function buildPlanChangeDisplay(preview: PlanChangePreview): PlanChangeDisplay | null {
  const daysRemaining = preview.currentPeriod?.daysRemaining ?? 0;
  if (preview.direction === "cadence_change") {
    return null;
  }

  if (preview.direction === "downgrade") {
    return {
      direction: "downgrade",
      daysRemaining,
      newAmount: preview.firstPayment.fullAmount,
    };
  }

  return {
    daysRemaining,
    direction: "upgrade",
    fullAmount: preview.firstPayment.fullAmount,
    proratedAmount: preview.firstPayment.amount,
    unusedCredit: preview.firstPayment.credit,
  };
}

export type UpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: MembershipTier;
  onUpgrade: (tierId: string, billingPeriod: "monthly" | "yearly") => void;
  isLoading?: boolean;
};

export function UpgradeDialog({
  open,
  onOpenChange,
  currentTier,
  onUpgrade,
  isLoading = false,
}: UpgradeDialogProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selectedTier, setSelectedTier] = useState<string>();

  const { getPlanChangeType, activeSubscription } = useMembership();
  const [hoveredTierId, setHoveredTierId] = useState<string>();

  const { data: allTiersRaw = [] } = useQuery<PricingTier[]>({
    queryKey: queryKeys.subscriptions.productTiers(),
    queryFn: usePricingTiers,
  });

  // Fetch the server's Plan change preview when a tier is hovered/selected
  const previewTargetId = hoveredTierId ?? selectedTier;

  const { data: serverPreview, isLoading: isPreviewLoading } = usePlanChangePreview({
    subscriptionId: activeSubscription?.id,
    targetTierId: previewTargetId,
    billingPeriod,
    enabled: Boolean(activeSubscription),
  });

  const planChangeDisplay = serverPreview ? buildPlanChangeDisplay(serverPreview) : null;

  // Sort tiers by displayOrder and filter to plan changes (upgrades + downgrades)
  const allTiers = [...allTiersRaw].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const hasYearlyPlans = allTiers.some((tier) => tier.price.yearly > 0);
  const savingsPercent = Math.max(...allTiers.map((tier) => tier.yearlySavingsPercent ?? 0), 0);

  const availableTiers = allTiers.filter((tier) => {
    const changeType = getPlanChangeType(tier.id);
    return changeType === "upgrade" || changeType === "downgrade";
  });

  const handleUpgrade = (tierId: string) => {
    setSelectedTier(tierId);
    onUpgrade(tierId, billingPeriod);
  };

  const handleTierHover = (tierId: string | undefined) => {
    if (activeSubscription) {
      setHoveredTierId(tierId);
    }
  };

  // Helper function to calculate yearly savings (inline for now)
  // const getYearlySavings = (tier: MembershipTierConfig) => {
  //   if (tier.price.monthly === 0) return null;
  //   return calculateYearlySavings(tier.price.monthly, tier.price.yearly);
  // };

  if (availableTiers.length === 0) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No Plan Changes Available</DialogTitle>
            <DialogDescription>
              There are no other plans available. Contact our sales team for custom enterprise
              solutions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-4">
            <MembershipBadge size="lg" tier={currentTier} />
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Contact Sales
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="space-y-4">
          <div className="space-y-2">
            <DialogTitle className="text-2xl">Change Your Plan</DialogTitle>
            <DialogDescription className="text-base">
              Choose a plan that fits your needs
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Currently on:</span>
            <MembershipBadge tier={currentTier} />
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Billing Period Toggle */}
          {hasYearlyPlans && (
            <div className="flex items-center justify-center">
              <Tabs
                className="w-fit"
                onValueChange={(value) => setBillingPeriod(value as "monthly" | "yearly")}
                value={billingPeriod}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger className="relative" value="yearly">
                    Yearly
                    {savingsPercent > 0 && (
                      <Badge className="ml-2 h-5 px-1.5 text-xs" variant="secondary">
                        -{savingsPercent}%
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Plan Change Preview */}
          {activeSubscription &&
            planChangeDisplay &&
            previewTargetId &&
            planChangeDisplay.direction === "upgrade" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Upgrade Preview</span>
                      {isPreviewLoading && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <span>
                        Credit from current plan:{" "}
                        <span className="font-medium text-green-600 dark:text-green-400">
                          -{formatCurrency(planChangeDisplay.unusedCredit)}
                        </span>
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{planChangeDisplay.daysRemaining} days remaining</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground text-xs line-through">
                      {formatCurrency(planChangeDisplay.fullAmount)}
                    </div>
                    <div className="font-bold text-lg">
                      {formatCurrency(planChangeDisplay.proratedAmount)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      then {formatCurrency(planChangeDisplay.fullAmount)}/mo
                    </div>
                  </div>
                </div>
              </div>
            )}

          {activeSubscription &&
            planChangeDisplay &&
            previewTargetId &&
            planChangeDisplay.direction === "downgrade" && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium text-sm">Downgrade Preview</span>
                      {isPreviewLoading && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Clock className="h-3 w-3" />
                      <span>
                        Current benefits kept for {planChangeDisplay.daysRemaining} more days
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatCurrency(planChangeDisplay.newAmount)}/mo
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Pricing Cards */}
          <div
            className={cn(
              "grid gap-6",
              availableTiers.length === 1 && "mx-auto max-w-sm grid-cols-1",
              availableTiers.length === 2 && "grid-cols-1 md:grid-cols-2",
              availableTiers.length >= MIN_TIERS_FOR_THREE_COLUMN &&
                "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {availableTiers.map((tier) => (
              <PricingCard
                billingPeriod={billingPeriod}
                changeType={getPlanChangeType(tier.id)}
                currentTier={currentTier}
                disabled={isLoading}
                hasActiveSubscription={!!activeSubscription}
                isLoading={isLoading && selectedTier === tier.id}
                isPopular={tier.id === "pro"}
                key={tier.id}
                onSelect={(id: string) => {
                  handleTierHover(tier.id);
                  handleUpgrade(id);
                }}
                tier={tier}
              />
            ))}
          </div>

          {/* Enterprise CTA */}
          {!availableTiers.find((t) => t.id === "ultimate") && currentTier !== "ultimate" && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium text-sm">Need Enterprise Features?</span>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Custom solutions, dedicated support, and unlimited usage for large
                    organizations.
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Contact Sales
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
