import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Crown, Building2, Sparkles, Database, Zap, Users, FileText, Infinity } from "lucide-react";
import { formatCurrency, calculateYearlySavings } from "@nvn/payments/client";
import type { PolarPricingTier } from "@/types/polar-pricing";

export interface PricingCardProps {
  tier: PolarPricingTier;
  billingPeriod: "monthly" | "yearly";
  currentTier?: string;
  isPopular?: boolean;
  onSelect?: (tierId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const tierIcons = {
  basic: Sparkles,
  pro: Crown, 
  ultimate: Building2,
};

const limitIcons = {
  storage: Database,
  apiCalls: Zap,
  users: Users,
  projects: FileText,
  documents: FileText,
  requests: Zap,
  uploads: Database,
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
    
    // Get the correct Polar product ID based on billing period
    const productId = billingPeriod === "yearly" 
      ? tier.yearly?.id 
      : tier.monthly?.id;
    
    if (!productId) {
      console.error(`No ${billingPeriod} product ID found for tier ${tier.id}`);
      return;
    }
    
    onSelect(productId);
  };

  const getButtonText = () => {
    if (isCurrentTier) return "Current Plan";
    if (tier.id === "basic") return "Get Started";
    if (tier.id === "ultimate") return "Contact Sales";
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
            tier.id === "basic" && "bg-blue-100 text-blue-600 dark:bg-blue-900/20",
            tier.id === "pro" && "bg-purple-100 text-purple-600 dark:bg-purple-900/20",
            tier.id === "ultimate" && "bg-orange-100 text-orange-600 dark:bg-orange-900/20"
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
            {(tier.features || []).map((feature: string, index: number) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {tier.limits && Object.keys(tier.limits).length > 0 && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                  <Database className="h-3 w-3 text-primary" />
                </div>
                Usage Limits
              </div>
              <div className="space-y-3">
                {Object.entries(tier.limits).map(([key, value]: [string, number]) => {
                  const IconComponent = limitIcons[key as keyof typeof limitIcons] || FileText;
                  const isUnlimited = value === -1;
                  
                  const formatValue = () => {
                    if (isUnlimited) return "Unlimited";
                    if (key === "storage") return `${value}GB`;
                    if (key === "apiCalls" || key === "requests") return `${value.toLocaleString()}/mo`;
                    return value.toLocaleString();
                  };
                  
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-muted">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          isUnlimited 
                            ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        )}>
                          {isUnlimited ? (
                            <Infinity className="h-4 w-4" />
                          ) : (
                            <IconComponent className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium capitalize">
                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {key === "storage" && "File storage space"}
                            {key === "apiCalls" && "API requests per month"}
                            {key === "users" && "Team members"}
                            {key === "projects" && "Active projects"}
                            {key === "documents" && "Documents & files"}
                            {key === "requests" && "Monthly requests"}
                            {key === "uploads" && "File uploads"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-semibold",
                          isUnlimited 
                            ? "text-green-600 dark:text-green-400"
                            : "text-foreground"
                        )}>
                          {formatValue()}
                        </span>
                        {isUnlimited && (
                          <Badge variant="secondary" className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            ∞
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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