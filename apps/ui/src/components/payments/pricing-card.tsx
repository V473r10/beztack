import { calculateYearlySavings, formatCurrency } from "@nvn/payments/client";
import {
  Building2,
  Check,
  Crown,
  Database,
  FileText,
  Infinity as InfinityIcon,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PolarPricingTier } from "@/types/polar-pricing";

export type PricingCardProps = {
  tier: PolarPricingTier;
  billingPeriod: "monthly" | "yearly";
  currentTier?: string;
  isPopular?: boolean;
  onSelect?: (tierId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

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

// Helper function to get tier styling classes
function getTierStyling(tierId: string) {
  const baseClasses = "flex h-10 w-10 items-center justify-center rounded-lg";

  if (tierId === "basic") {
    return `${baseClasses} bg-blue-100 text-blue-600 dark:bg-blue-900/20`;
  }
  if (tierId === "pro") {
    return `${baseClasses} bg-purple-100 text-purple-600 dark:bg-purple-900/20`;
  }
  if (tierId === "ultimate") {
    return `${baseClasses} bg-orange-100 text-orange-600 dark:bg-orange-900/20`;
  }
  return baseClasses;
}

// Helper function to format limit values
function formatLimitValue(key: string, value: number) {
  if (value === -1) {
    return "Unlimited";
  }

  if (key === "storage") {
    return `${value} GB`;
  }
  if (key === "requests") {
    return value.toLocaleString();
  }
  if (key === "uploads") {
    return value.toLocaleString();
  }
  return value.toString();
}

// Helper function to get limit icon
function getLimitIcon(key: string) {
  return limitIcons[key as keyof typeof limitIcons] || FileText;
}

export function PricingCard({
  tier,
  billingPeriod,
  currentTier,
  isPopular = false,
  onSelect,
  isLoading = false,
  disabled = false,
}: PricingCardProps) {
  const { t } = useTranslation();
  const Icon = tierIcons[tier.id as keyof typeof tierIcons] || Sparkles;
  const isCurrentTier = currentTier === tier.id;
  const price = tier.price[billingPeriod];
  const yearlyPrice = tier.price.yearly;
  const monthlyPrice = tier.price.monthly;

  // Calculate savings for yearly billing
  const savings =
    billingPeriod === "yearly" && monthlyPrice > 0
      ? calculateYearlySavings(monthlyPrice, yearlyPrice)
      : null;

  const handleSelect = () => {
    if (!onSelect || disabled || isLoading || isCurrentTier) {
      return;
    }

    // Get the correct Polar product ID based on billing period
    const productId =
      billingPeriod === "yearly" ? tier.yearly?.id : tier.monthly?.id;

    if (!productId) {
      return;
    }

    onSelect(productId);
  };

  const getButtonText = () => {
    if (isCurrentTier) {
      return "Current Plan";
    }
    if (tier.id === "basic") {
      return "Get Started";
    }
    if (tier.id === "ultimate") {
      return "Contact Sales";
    }
    return "Upgrade";
  };

  const getButtonVariant = () => {
    if (isCurrentTier) {
      return "outline";
    }
    if (isPopular) {
      return "default";
    }
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
        <div className="-top-3 -translate-x-1/2 absolute left-1/2">
          <Badge className="px-3 py-1" variant="default">
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={getTierStyling(tier.id)}>
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
            <span className="font-bold text-3xl">
              {price === 0 ? "Free" : formatCurrency(price)}
            </span>
            {price > 0 && (
              <span className="text-muted-foreground text-sm">
                /{billingPeriod === "yearly" ? "year" : "month"}
              </span>
            )}
          </div>

          {savings && (
            <div className="flex items-center gap-2 text-green-600 text-sm dark:text-green-400">
              <Badge className="px-2 py-0.5 text-xs" variant="secondary">
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
          <div className="font-medium text-sm">Features included:</div>
          <ul className="space-y-2">
            {(tier.features || []).map((feature: string, _index: number) => (
              <li
                className="flex items-start gap-3 text-sm"
                key={`${tier.id}-feature-${feature}-${crypto.randomUUID()}`}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{t(`pricing.features.${feature}`, feature)}</span>
              </li>
            ))}
          </ul>
        </div>

        {tier.limits && Object.keys(tier.limits).length > 0 && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-sm">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                  <Database className="h-3 w-3 text-primary" />
                </div>
                Usage Limits
              </div>
              <div className="space-y-3">
                {Object.entries(tier.limits).map(
                  ([key, value]: [string, number]) => {
                    const IconComponent =
                      limitIcons[key as keyof typeof limitIcons] || FileText;
                    const isUnlimited = value === -1;

                    const formatValue = () => {
                      if (isUnlimited) {
                        return "Unlimited";
                      }
                      if (key === "storage") {
                        return `${value}GB`;
                      }
                      if (key === "apiCalls" || key === "requests") {
                        return `${value.toLocaleString()}/mo`;
                      }
                      return value.toLocaleString();
                    };

                    return (
                      <div
                        className="flex items-center justify-between rounded-lg border border-muted bg-muted/30 p-3"
                        key={key}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              isUnlimited
                                ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                            )}
                          >
                            {isUnlimited ? (
                              <Infinity className="h-4 w-4" />
                            ) : (
                              <IconComponent className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm capitalize">
                              {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                            </span>
                            <span className="text-muted-foreground text-xs">
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
                          <span
                            className={cn(
                              "font-semibold text-sm",
                              isUnlimited
                                ? "text-green-600 dark:text-green-400"
                                : "text-foreground"
                            )}
                          >
                            {formatValue()}
                          </span>
                          {isUnlimited && (
                            <Badge
                              className="bg-green-100 px-2 py-0.5 text-green-700 text-xs dark:bg-green-900/20 dark:text-green-400"
                              variant="secondary"
                            >
                              ∞
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          disabled={disabled || isLoading || isCurrentTier}
          onClick={handleSelect}
          size="lg"
          variant={
            getButtonVariant() as
              | "default"
              | "destructive"
              | "outline"
              | "secondary"
              | "ghost"
              | "link"
          }
        >
          {isLoading ? "Processing..." : getButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
}
