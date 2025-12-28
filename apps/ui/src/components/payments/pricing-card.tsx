import {
  ArrowDown,
  ArrowUp,
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
import { motion } from "motion/react";
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
import type { PlanChangeType } from "@/contexts/membership-context";
import { cn } from "@/lib/utils";
import type { PolarPricingTier } from "@/types/polar-pricing";

export type PricingCardProps = {
  tier: PolarPricingTier;
  billingPeriod: "monthly" | "yearly";
  currentTier?: string;
  changeType?: PlanChangeType;
  hasActiveSubscription?: boolean;
  isPopular?: boolean;
  onSelect?: (tierId: string) => void;
  onPlanChange?: (tier: PolarPricingTier) => void;
  isLoading?: boolean;
  disabled?: boolean;
  index?: number;
};

const ANIMATION_DELAY_STEP = 0.1;

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

function getTierStyling(tierId: string) {
  const baseClasses =
    "flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300";

  if (tierId === "basic") {
    return `${baseClasses} bg-blue-100/50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30`;
  }
  if (tierId === "pro") {
    return `${baseClasses} bg-primary/10 text-primary group-hover:bg-primary/20`;
  }
  if (tierId === "ultimate") {
    return `${baseClasses} bg-orange-100/50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30`;
  }
  return baseClasses;
}

export function PricingCard({
  tier,
  billingPeriod,
  currentTier,
  changeType = "same",
  hasActiveSubscription = false,
  isPopular = false,
  onSelect,
  onPlanChange,
  isLoading = false,
  disabled = false,
  index = 0,
}: PricingCardProps) {
  const { t } = useTranslation();
  const Icon = tierIcons[tier.id as keyof typeof tierIcons] || Sparkles;
  const isCurrentTier = currentTier === tier.id;
  const price = tier.price[billingPeriod];
  const yearlyPrice = tier.price.yearly;
  const monthlyPrice = tier.price.monthly;

  const savings =
    billingPeriod === "yearly" && monthlyPrice > 0
      ? calculateYearlySavings(monthlyPrice, yearlyPrice)
      : null;

  const handleSelect = () => {
    if (disabled || isLoading || isCurrentTier) {
      return;
    }

    // If user has an active subscription, trigger plan change flow
    if (hasActiveSubscription && onPlanChange) {
      onPlanChange(tier);
      return;
    }

    // Otherwise, proceed with new checkout
    if (!onSelect) {
      return;
    }

    const productId =
      billingPeriod === "yearly" ? tier.yearly?.id : tier.monthly?.id;

    if (!productId) {
      return;
    }

    onSelect(productId);
  };

  const getButtonText = () => {
    if (isCurrentTier) {
      return t("pricing.currentPlan", "Current Plan");
    }
    if (tier.id === "ultimate") {
      return t("pricing.contactSales", "Contact Sales");
    }
    if (hasActiveSubscription) {
      if (changeType === "downgrade") {
        return t("pricing.downgrade", "Downgrade");
      }
      return t("pricing.upgrade", "Upgrade");
    }
    if (tier.id === "basic" || tier.price.monthly === 0) {
      return t("pricing.getStarted", "Get Started");
    }
    return t("pricing.subscribe", "Subscribe");
  };

  const getButtonIcon = () => {
    if (isCurrentTier || !hasActiveSubscription) {
      return null;
    }
    if (changeType === "downgrade") {
      return <ArrowDown className="mr-1.5 h-4 w-4" />;
    }
    if (changeType === "upgrade") {
      return <ArrowUp className="mr-1.5 h-4 w-4" />;
    }
    return null;
  };

  const getButtonVariant = () => {
    if (isCurrentTier) {
      return "outline";
    }
    if (changeType === "downgrade") {
      return "secondary";
    }
    if (isPopular || changeType === "upgrade") {
      return "default";
    }
    return "outline";
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="h-full"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, delay: index * ANIMATION_DELAY_STEP }}
    >
      <Card
        className={cn(
          "group relative flex h-full w-full flex-col overflow-hidden transition-all duration-300 hover:shadow-xl dark:hover:shadow-primary/5",
          isPopular
            ? "border-primary/50 shadow-md shadow-primary/5"
            : "border-border hover:border-primary/20",
          isCurrentTier && "border-muted bg-muted/10 opacity-75 grayscale-[0.5]"
        )}
      >
        {isPopular && (
          <div className="absolute top-0 right-0">
            <div className="rounded-bl-xl bg-primary px-3 py-1 font-medium text-primary-foreground text-xs">
              Popular
            </div>
          </div>
        )}

        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center gap-4">
            <div className={getTierStyling(tier.id)}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="font-bold text-xl tracking-tight">
                {tier.name}
              </CardTitle>
              <CardDescription className="line-clamp-1 text-sm">
                {tier.description}
              </CardDescription>
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-4xl tracking-tight">
                {price === 0 ? "Free" : formatCurrency(price)}
              </span>
              {price > 0 && (
                <span className="font-medium text-muted-foreground text-sm">
                  /{billingPeriod === "yearly" ? "year" : "month"}
                </span>
              )}
            </div>

            {savings ? (
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                  variant="secondary"
                >
                  Save {savings.formattedPercentage}
                </Badge>
                <span className="text-green-600 text-xs dark:text-green-400">
                  {savings.formattedAmount} yearly
                </span>
              </div>
            ) : (
              <div className="h-6" />
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-6">
          <Separator className="bg-border/50" />

          <div className="space-y-4">
            <div className="font-semibold text-foreground/80 text-sm">
              Includes:
            </div>
            <ul className="space-y-3">
              {(tier.features || []).map((feature: string) => (
                <li
                  className="flex items-start gap-3 text-muted-foreground text-sm"
                  key={`${tier.id}-feature-${feature}-${crypto.randomUUID()}`}
                >
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <span className="leading-tight">
                    {t(`pricing.features.${feature}`, feature)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {tier.limits && Object.keys(tier.limits).length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="font-semibold text-foreground/80 text-sm">
                Limits:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(tier.limits).map(
                  ([key, value]: [string, number]) => {
                    const IconComponent =
                      limitIcons[key as keyof typeof limitIcons] || FileText;
                    const isUnlimited = value === -1;

                    return (
                      <div
                        className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                        key={key}
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs capitalize">
                            {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                          </span>
                        </div>
                        <div className="font-medium text-xs">
                          {isUnlimited ? (
                            <span className="flex items-center gap-1 text-primary">
                              <InfinityIcon className="h-3 w-3" />
                            </span>
                          ) : (
                            <span>
                              {value.toLocaleString()}
                              {key === "storage" && "GB"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-6">
          <Button
            className={cn(
              "w-full font-semibold transition-all hover:scale-[1.02]",
              isPopular ? "shadow-md shadow-primary/20" : "",
              changeType === "upgrade" &&
                hasActiveSubscription &&
                "bg-green-600 hover:bg-green-700",
              changeType === "downgrade" &&
                hasActiveSubscription &&
                "bg-amber-600 text-white hover:bg-amber-700"
            )}
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
            {isLoading ? (
              t("common.processing", "Processing...")
            ) : (
              <>
                {getButtonIcon()}
                {getButtonText()}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

const calculateYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
  const MONTHS_IN_YEAR = 12;
  const PERCENTAGE_MULTIPLIER = 100;

  if (monthlyPrice <= 0 || yearlyPrice <= 0) {
    return null;
  }

  const monthlyYearlyTotal = monthlyPrice * MONTHS_IN_YEAR;
  const savingsAmount = Math.max(0, monthlyYearlyTotal - yearlyPrice);

  if (savingsAmount === 0) {
    return null;
  }

  const savingsPercentage =
    (savingsAmount / monthlyYearlyTotal) * PERCENTAGE_MULTIPLIER;

  return {
    formattedPercentage: `${savingsPercentage.toFixed(1)}%`,
    formattedAmount: formatCurrency(savingsAmount),
  };
};

export const formatCurrency = (amount: number, currency = "USD"): string => {
  const CENTS_TO_DOLLARS = 100;
  const dollars = amount / CENTS_TO_DOLLARS;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
};
