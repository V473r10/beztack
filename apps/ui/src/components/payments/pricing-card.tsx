import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Crown, Users, Building2, Sparkles } from "lucide-react";
import { formatCurrency, calculateYearlySavings } from "@nvn/payments/client";
import type { MembershipTierConfig } from "@nvn/payments/types";

export interface PricingCardProps {
  tier: MembershipTierConfig;
  billingPeriod: "monthly" | "yearly";
  currentTier?: string;
  isPopular?: boolean;
  onSelect?: (tierId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const tierIcons = {
  free: Sparkles,
  pro: Crown,
  team: Users,
  enterprise: Building2,
};

export function PricingCard({
  tier,
  billingPeriod,
  currentTier,
  isPopular = false,
  onSelect,
  isLoading = false,
  disabled = false,
}: PricingCardProps) {
  const Icon = tierIcons[tier.id as keyof typeof tierIcons] || Sparkles;
  const isCurrentTier = currentTier === tier.id;
  const price = tier.price[billingPeriod];
  const yearlyPrice = tier.price.yearly;
  const monthlyPrice = tier.price.monthly;
  
  // Calculate savings for yearly billing
  const savings = billingPeriod === "yearly" && monthlyPrice > 0 
    ? calculateYearlySavings(monthlyPrice, yearlyPrice)
    : null;

  const handleSelect = () => {
    if (!onSelect || disabled || isLoading || isCurrentTier) return;
    onSelect(tier.id);
  };

  const getButtonText = () => {
    if (isCurrentTier) return "Current Plan";
    if (tier.id === "free") return "Get Started";
    if (tier.id === "enterprise") return "Contact Sales";
    return "Upgrade";
  };

  const getButtonVariant = () => {
    if (isCurrentTier) return "outline";
    if (isPopular) return "default";
    return "outline";
  };

  return (
    <Card 
      className={cn(
        "relative h-full w-full",
        isPopular && "border-primary shadow-lg",
        isCurrentTier && "bg-muted/30"
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="default" className="px-3 py-1">
            Most Popular
          </Badge>
        </div>
      )}
      
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            tier.id === "free" && "bg-blue-100 text-blue-600 dark:bg-blue-900/20",
            tier.id === "pro" && "bg-purple-100 text-purple-600 dark:bg-purple-900/20",
            tier.id === "team" && "bg-green-100 text-green-600 dark:bg-green-900/20",
            tier.id === "enterprise" && "bg-orange-100 text-orange-600 dark:bg-orange-900/20"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">{tier.name}</CardTitle>
            <CardDescription className="text-sm">
              {tier.description}
            </CardDescription>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">
              {price === 0 ? "Free" : formatCurrency(price)}
            </span>
            {price > 0 && (
              <span className="text-sm text-muted-foreground">
                /{billingPeriod === "yearly" ? "year" : "month"}
              </span>
            )}
          </div>
          
          {savings && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                Save {savings.formattedPercentage}
              </Badge>
              <span>({savings.formattedAmount} yearly)</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Separator />
        
        <div className="space-y-3">
          <div className="text-sm font-medium">Features included:</div>
          <ul className="space-y-2">
            {tier.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {tier.limits && Object.keys(tier.limits).length > 0 && (
          <div className="space-y-3">
            <Separator />
            <div className="text-sm font-medium">Usage limits:</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(tier.limits).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize text-muted-foreground">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
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
        )}
      </CardContent>
      
      <CardFooter>
        <Button
          className="w-full"
          variant={getButtonVariant() as any}
          onClick={handleSelect}
          disabled={disabled || isLoading || isCurrentTier}
          size="lg"
        >
          {isLoading ? "Processing..." : getButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
}