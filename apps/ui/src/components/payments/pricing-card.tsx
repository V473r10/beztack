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
import { Link } from "react-router";
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
import type { PricingTier } from "@/types/pricing";
import { formatNumber, formatPrice } from "@/lib/format";

export type PricingCardProps = {
  tier: PricingTier;
  billingPeriod: "monthly" | "yearly";
  currentTier?: string;
  changeType?: PlanChangeType;
  hasActiveSubscription?: boolean;
  /** Whether the visitor has an account; the Free plan leads them to sign-up or to the app. */
  isSignedIn?: boolean;
  isPopular?: boolean;
  onSelect?: (tierId: string) => void;
  onPlanChange?: (tier: PricingTier) => void;
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
  isSignedIn = false,
  isPopular = false,
  onSelect,
  onPlanChange,
  isLoading = false,
  disabled = false,
  index = 0,
}: PricingCardProps) {
  const { t } = useTranslation();
  const Icon = tierIcons[tier.id as keyof typeof tierIcons] || Sparkles;
  const features = tier.features ?? [];
  // The current tier on another Billing cadence is still a Plan change
  // ("Switch billing"), offered only when the provider can do it.
  const isCadenceSwitch = currentTier === tier.id && changeType === "period_change";
  // A visitor without an account has no current plan, whatever the context's default tier.
  const isCurrentTier =
    currentTier === tier.id && !isCadenceSwitch && !(tier.catalogOnly && !isSignedIn);
  // "Coming soon" plans are shown but cannot be bought or switched to.
  const isSoon = tier.soon === true && !isCurrentTier;
  const price = tier.price[billingPeriod];
  const yearlyPrice = tier.price.yearly;
  const monthlyPrice = tier.price.monthly;

  const savings =
    billingPeriod === "yearly" && monthlyPrice > 0
      ? calculateYearlySavings(monthlyPrice, yearlyPrice, tier.currency)
      : null;

  const productId = billingPeriod === "yearly" ? tier.yearly?.id : tier.monthly?.id;
  // Free lives in the catalog only: no product, no checkout.
  const isFreePlan = tier.catalogOnly === true && monthlyPrice === 0 && yearlyPrice === 0;
  // A plan with no product for this cadence cannot be bought here.
  const canBuy = !(tier.catalogOnly || !productId);
  const freeHref = isSignedIn ? "/" : "/auth/sign-up";

  const handleSelect = () => {
    if (disabled || isLoading || isCurrentTier || isSoon || !canBuy) {
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

    if (!productId) {
      return;
    }

    onSelect(productId);
  };

  const getButtonText = () => {
    if (isCurrentTier) {
      return t("pricing.currentPlan", "Current Plan");
    }
    if (isSoon) {
      return t("pricing.soon", "Coming soon");
    }
    if (isFreePlan) {
      return isSignedIn ? t("pricing.goToApp") : t("pricing.startFree");
    }
    if (!canBuy) {
      return t("pricing.contactSales", "Contact Sales");
    }
    if (hasActiveSubscription) {
      if (isCadenceSwitch) {
        return t("pricing.switchBilling", "Switch billing");
      }
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
    if (isCurrentTier || isSoon || !hasActiveSubscription) {
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
          isCurrentTier && "border-muted bg-muted/10 opacity-75 grayscale-[0.5]",
        )}
      >
        {isPopular && (
          <div className="absolute top-0 right-0">
            <div className="rounded-bl-xl bg-primary px-3 py-1 font-medium text-primary-foreground text-xs">
              {t("pricing.card.popular")}
            </div>
          </div>
        )}

        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center gap-4">
            <div className={getTierStyling(tier.id)}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 font-bold text-xl tracking-tight">
                {tier.name}
                {isSoon && <Badge variant="secondary">{t("pricing.soon", "Coming soon")}</Badge>}
              </CardTitle>
              <CardDescription className="line-clamp-1 text-sm">{tier.description}</CardDescription>
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-4xl tracking-tight">
                {price === 0 ? t("pricing.card.free") : formatPrice(price, tier.currency)}
              </span>
              {price > 0 && (
                <span className="font-medium text-muted-foreground text-sm">
                  {billingPeriod === "yearly"
                    ? t("pricing.card.perYear")
                    : t("pricing.card.perMonth")}
                </span>
              )}
            </div>

            {savings ? (
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                  variant="secondary"
                >
                  {t("billing.savePercent", { percent: savings.percentage })}
                </Badge>
                <span className="text-green-600 text-xs dark:text-green-400">
                  {t("pricing.card.yearlySaving", { amount: savings.formattedAmount })}
                </span>
              </div>
            ) : (
              <div className="h-6" />
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-6">
          <Separator className="bg-border/50" />

          {features.length > 0 && (
            <div className="space-y-4">
              <div className="font-semibold text-foreground/80 text-sm">
                {t("pricing.card.includes")}
              </div>
              <ul className="space-y-3">
                {features.map((feature: string) => (
                  <li
                    className="flex items-start gap-3 text-muted-foreground text-sm"
                    key={`${tier.id}-feature-${feature}`}
                  >
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-2.5 w-2.5 text-primary" />
                    </div>
                    <span className="leading-tight">
                      {t(`pricing.features.${feature}`, { defaultValue: feature })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tier.limits && Object.keys(tier.limits).length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="font-semibold text-foreground/80 text-sm">
                {t("pricing.card.limits")}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(tier.limits).map(([key, value]: [string, number]) => {
                  const IconComponent = limitIcons[key as keyof typeof limitIcons] || FileText;
                  const isUnlimited = value === -1;

                  return (
                    <div
                      className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                      key={key}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">
                          {t(`pricing.limits.${key}`, {
                            defaultValue: key.replace(/([A-Z])/g, " $1").toLowerCase(),
                          })}
                        </span>
                      </div>
                      <div className="font-medium text-xs">
                        {isUnlimited ? (
                          <span className="flex items-center gap-1 text-primary">
                            <InfinityIcon className="h-3 w-3" />
                          </span>
                        ) : (
                          <span>
                            {formatNumber(value)}
                            {key === "storage" && "GB"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-6">
          {isFreePlan && !isCurrentTier ? (
            <Button asChild className="w-full font-semibold" size="lg" variant="outline">
              <Link to={freeHref}>{getButtonText()}</Link>
            </Button>
          ) : (
            <Button
              className={cn(
                "w-full font-semibold transition-all hover:scale-[1.02]",
                isPopular ? "shadow-md shadow-primary/20" : "",
                changeType === "upgrade" &&
                  hasActiveSubscription &&
                  "bg-green-600 hover:bg-green-700",
                changeType === "downgrade" &&
                  hasActiveSubscription &&
                  "bg-amber-600 text-white hover:bg-amber-700",
              )}
              disabled={disabled || isLoading || isCurrentTier || isSoon || !canBuy}
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
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

const calculateYearlySavings = (monthlyPrice: number, yearlyPrice: number, currency?: string) => {
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

  const savingsPercentage = (savingsAmount / monthlyYearlyTotal) * PERCENTAGE_MULTIPLIER;

  return {
    percentage: savingsPercentage.toFixed(1),
    formattedAmount: formatPrice(savingsAmount, currency),
  };
};
