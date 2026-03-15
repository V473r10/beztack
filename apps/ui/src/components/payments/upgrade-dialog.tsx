import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { MembershipTier } from "@/types/membership";
import type { PricingTier } from "@/types/pricing";
import { MembershipBadge } from "./membership-badge";
import { PricingCard } from "./pricing-card";

// Constants
const MIN_TIERS_FOR_THREE_COLUMN = 3;

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
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [selectedTier, setSelectedTier] = useState<string>();

  const { getPlanChangeType } = useMembership();

  const { data: allTiersRaw = [] } = useQuery<PricingTier[]>({
    queryKey: ["subscriptions", "products", "tiers"],
    queryFn: usePricingTiers,
  });

  // Sort tiers by displayOrder and filter to upgrades only
  const allTiers = [...allTiersRaw].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  const hasYearlyPlans = allTiers.some((tier) => tier.price.yearly > 0);
  const savingsPercent = Math.max(
    ...allTiers.map((tier) => tier.yearlySavingsPercent ?? 0),
    0
  );

  const availableTiers = allTiers.filter(
    (tier) => getPlanChangeType(tier.id) === "upgrade"
  );

  const handleUpgrade = (tierId: string) => {
    setSelectedTier(tierId);
    onUpgrade(tierId, billingPeriod);
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
            <DialogTitle>Already at Maximum Tier</DialogTitle>
            <DialogDescription>
              You're currently on the highest available plan. Contact our sales
              team for custom enterprise solutions.
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
            <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
            <DialogDescription className="text-base">
              Unlock more features and higher limits with a premium plan
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
                onValueChange={(value) =>
                  setBillingPeriod(value as "monthly" | "yearly")
                }
                value={billingPeriod}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger className="relative" value="yearly">
                    Yearly
                    {savingsPercent > 0 && (
                      <Badge
                        className="ml-2 h-5 px-1.5 text-xs"
                        variant="secondary"
                      >
                        -{savingsPercent}%
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Pricing Cards */}
          <div
            className={cn(
              "grid gap-6",
              availableTiers.length === 1 && "mx-auto max-w-sm grid-cols-1",
              availableTiers.length === 2 && "grid-cols-1 md:grid-cols-2",
              availableTiers.length >= MIN_TIERS_FOR_THREE_COLUMN &&
                "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            )}
          >
            {availableTiers.map((tier) => (
              <PricingCard
                billingPeriod={billingPeriod}
                currentTier={currentTier}
                disabled={isLoading}
                isLoading={isLoading && selectedTier === tier.id}
                isPopular={tier.id === "pro"}
                key={tier.id}
                onSelect={handleUpgrade}
                tier={tier}
              />
            ))}
          </div>

          {/* Enterprise CTA */}
          {!availableTiers.find((t) => t.id === "ultimate") &&
            currentTier !== "ultimate" && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium text-sm">
                        Need Enterprise Features?
                      </span>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Custom solutions, dedicated support, and unlimited usage
                      for large organizations.
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
