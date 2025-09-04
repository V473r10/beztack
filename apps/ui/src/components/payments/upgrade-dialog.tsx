import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, Sparkles, ArrowRight } from "lucide-react";
import { PricingCard } from "./pricing-card";
import { MembershipBadge } from "./membership-badge";
import { getAllTiers, isTierHigher } from "@nvn/payments/constants";
import type { MembershipTier } from "@nvn/payments/types";

export interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: MembershipTier;
  onUpgrade: (tierId: string, billingPeriod: "monthly" | "yearly") => void;
  isLoading?: boolean;
  suggestedTier?: MembershipTier;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  currentTier,
  onUpgrade,
  isLoading = false,
  suggestedTier,
}: UpgradeDialogProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selectedTier, setSelectedTier] = useState<string>(suggestedTier || "pro");
  
  const allTiers = getAllTiers();
  const availableTiers = allTiers.filter(tier => 
    isTierHigher(tier.id, currentTier)
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Already at Maximum Tier</DialogTitle>
            <DialogDescription>
              You're currently on the highest available plan. 
              Contact our sales team for custom enterprise solutions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-4">
            <MembershipBadge tier={currentTier} size="lg" />
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Contact Sales
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="space-y-2">
            <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
            <DialogDescription className="text-base">
              Unlock more features and higher limits with a premium plan
            </DialogDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Currently on:</span>
            <MembershipBadge tier={currentTier} />
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Billing Period Toggle */}
          <div className="flex items-center justify-center">
            <Tabs 
              value={billingPeriod} 
              onValueChange={(value) => setBillingPeriod(value as "monthly" | "yearly")}
              className="w-fit"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly" className="relative">
                  Yearly
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-5 px-1.5 text-xs"
                  >
                    Save 17%
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Pricing Cards */}
          <div className={cn(
            "grid gap-6",
            availableTiers.length === 1 && "grid-cols-1 max-w-sm mx-auto",
            availableTiers.length === 2 && "grid-cols-1 md:grid-cols-2",
            availableTiers.length >= 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          )}>
            {availableTiers.map((tier) => (
              <PricingCard
                key={tier.id}
                tier={tier}
                billingPeriod={billingPeriod}
                currentTier={currentTier}
                isPopular={tier.id === "pro"}
                onSelect={handleUpgrade}
                isLoading={isLoading && selectedTier === tier.id}
                disabled={isLoading}
              />
            ))}
          </div>

          {/* Upgrade Path */}
          {suggestedTier && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Recommended Upgrade</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Based on your usage patterns, the {availableTiers.find(t => t.id === suggestedTier)?.name} plan 
                  would be perfect for your needs.
                </div>
                <Button
                  size="sm"
                  onClick={() => handleUpgrade(suggestedTier)}
                  disabled={isLoading}
                  className="w-fit"
                >
                  Upgrade to {availableTiers.find(t => t.id === suggestedTier)?.name}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Enterprise CTA */}
          {!availableTiers.find(t => t.id === "enterprise") && currentTier !== "enterprise" && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium text-sm">Need Enterprise Features?</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Custom solutions, dedicated support, and unlimited usage for large organizations.
                  </div>
                </div>
                <Button variant="outline" size="sm">
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