import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { PlanChangeType } from "@/contexts/membership-context";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { cn } from "@/lib/utils";
import type { MembershipTier } from "@/types/membership";
import type { PolarPricingTier } from "@/types/polar-pricing";
import { formatCurrency } from "./pricing-card";

const MAX_FEATURES_TO_SHOW = 4;

type ChangeTypeConfig = {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  cardClass: string;
  buttonClass: string;
  confirmText: string;
};

function getChangeTypeConfig(
  changeType: PlanChangeType,
  t: (key: string, fallback: string) => string
): ChangeTypeConfig {
  const configs: Record<PlanChangeType, ChangeTypeConfig> = {
    upgrade: {
      icon: ArrowUp,
      iconColor: "text-green-500",
      title: t("billing.planChange.upgradeTitle", "Upgrade Your Plan"),
      description: t(
        "billing.planChange.upgradeDescription",
        "Unlock more features and higher limits with this upgrade."
      ),
      cardClass:
        "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
      buttonClass: "bg-green-600 hover:bg-green-700",
      confirmText: t("billing.planChange.confirmUpgrade", "Confirm Upgrade"),
    },
    downgrade: {
      icon: ArrowDown,
      iconColor: "text-amber-500",
      title: t("billing.planChange.downgradeTitle", "Change Your Plan"),
      description: t(
        "billing.planChange.downgradeDescription",
        "Review the changes before switching to a lower plan."
      ),
      cardClass:
        "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20",
      buttonClass: "bg-amber-600 hover:bg-amber-700",
      confirmText: t("billing.planChange.confirmDowngrade", "Continue"),
    },
    same: {
      icon: RefreshCw,
      iconColor: "text-blue-500",
      title: t("billing.planChange.switchTitle", "Switch Billing Period"),
      description: t(
        "billing.planChange.switchDescription",
        "Change your billing period for this plan."
      ),
      cardClass:
        "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20",
      buttonClass: "",
      confirmText: t("billing.planChange.confirmSwitch", "Switch Plan"),
    },
    period_change: {
      icon: RefreshCw,
      iconColor: "text-blue-500",
      title: t("billing.planChange.switchTitle", "Switch Billing Period"),
      description: t(
        "billing.planChange.switchDescription",
        "Change your billing period for this plan."
      ),
      cardClass:
        "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20",
      buttonClass: "",
      confirmText: t("billing.planChange.confirmSwitch", "Switch Plan"),
    },
  };

  return configs[changeType];
}

function getPriceDiffClass(priceDiff: number): string {
  if (priceDiff > 0) {
    return "text-green-600 dark:text-green-400";
  }
  if (priceDiff < 0) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-muted-foreground";
}

export type PlanChangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: MembershipTier;
  targetTier: PolarPricingTier | null;
  changeType: PlanChangeType;
  billingPeriod: "monthly" | "yearly";
  onBillingPeriodChange: (period: "monthly" | "yearly") => void;
  onConfirm: (productId: string) => Promise<void>;
  isLoading?: boolean;
};

export function PlanChangeDialog({
  open,
  onOpenChange,
  currentTier,
  targetTier,
  changeType,
  billingPeriod,
  onBillingPeriodChange,
  onConfirm,
  isLoading = false,
}: PlanChangeDialogProps) {
  const { t } = useTranslation();
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);

  const { data: allTiers = [] } = useQuery<PolarPricingTier[]>({
    queryKey: ["polar-products"],
    queryFn: usePolarProducts,
  });

  const currentTierData = allTiers.find((tier) => tier.id === currentTier);

  if (!targetTier) {
    return null;
  }

  const targetPrice = targetTier.price[billingPeriod];
  const currentPrice = currentTierData?.price[billingPeriod] ?? 0;
  const priceDiff = targetPrice - currentPrice;

  const productId =
    billingPeriod === "yearly" ? targetTier.yearly?.id : targetTier.monthly?.id;

  const handleConfirm = async () => {
    if (!productId) {
      return;
    }

    // For downgrades, show warning first
    if (changeType === "downgrade" && !showDowngradeWarning) {
      setShowDowngradeWarning(true);
      return;
    }

    await onConfirm(productId);
    setConfirmDowngrade(false);
    setShowDowngradeWarning(false);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setConfirmDowngrade(false);
    setShowDowngradeWarning(false);
    onOpenChange(false);
  };

  // Downgrade warning dialog
  if (showDowngradeWarning && changeType === "downgrade") {
    return (
      <AlertDialog onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-center">
              {t("billing.downgradeWarning.title", "Confirm Downgrade")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t(
                "billing.downgradeWarning.description",
                "You're about to downgrade your plan. Some features may become unavailable."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <h4 className="mb-2 font-medium text-amber-800 text-sm dark:text-amber-200">
                {t(
                  "billing.downgradeWarning.lossTitle",
                  "You may lose access to:"
                )}
              </h4>
              <ul className="space-y-1 text-amber-700 text-sm dark:text-amber-300">
                <li>
                  •{" "}
                  {t(
                    "billing.downgradeWarning.loss1",
                    "Premium features exclusive to your current plan"
                  )}
                </li>
                <li>
                  • {t("billing.downgradeWarning.loss2", "Higher usage limits")}
                </li>
                <li>
                  • {t("billing.downgradeWarning.loss3", "Priority support")}
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                checked={confirmDowngrade}
                id="confirm-downgrade"
                onCheckedChange={(checked) =>
                  setConfirmDowngrade(checked === true)
                }
              />
              <Label
                className="cursor-pointer text-muted-foreground text-sm leading-relaxed"
                htmlFor="confirm-downgrade"
              >
                {t(
                  "billing.downgradeWarning.confirmText",
                  "I understand that I may lose access to certain features and my usage limits will be reduced."
                )}
              </Label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!confirmDowngrade || isLoading}
              onClick={handleConfirm}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.processing", "Processing...")}
                </>
              ) : (
                t("billing.downgradeWarning.confirm", "Confirm Downgrade")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Main plan change dialog
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          {(() => {
            const config = getChangeTypeConfig(changeType, t);
            const IconComponent = config.icon;
            return (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <IconComponent className={cn("h-5 w-5", config.iconColor)} />
                  {config.title}
                </DialogTitle>
                <DialogDescription>{config.description}</DialogDescription>
              </>
            );
          })()}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Plan */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">
                {t("billing.planChange.currentPlan", "Current Plan")}
              </div>
              <div className="font-semibold capitalize">{currentTier}</div>
              <div className="mt-1 text-muted-foreground text-sm">
                {formatCurrency(currentPrice)}/
                {billingPeriod === "yearly" ? "year" : "month"}
              </div>
            </div>

            {/* Target Plan */}
            <div
              className={cn(
                "rounded-lg border p-4",
                getChangeTypeConfig(changeType, t).cardClass
              )}
            >
              <div className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">
                {t("billing.planChange.newPlan", "New Plan")}
              </div>
              <div className="font-semibold">{targetTier.name}</div>
              <div className="mt-1 text-sm">
                {formatCurrency(targetPrice)}/
                {billingPeriod === "yearly" ? "year" : "month"}
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing Period Selection */}
          <div className="space-y-2">
            <Label>
              {t("billing.planChange.billingPeriod", "Billing Period")}
            </Label>
            <Select
              onValueChange={(value) =>
                onBillingPeriodChange(value as "monthly" | "yearly")
              }
              value={billingPeriod}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">
                  {t("billing.monthly", "Monthly")}
                </SelectItem>
                <SelectItem value="yearly">
                  {t("billing.yearly", "Yearly")}
                  <Badge className="ml-2" variant="secondary">
                    {t("billing.save17", "Save 17%")}
                  </Badge>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price difference info */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("billing.planChange.priceChange", "Price Change")}
              </span>
              <span
                className={cn("font-semibold", getPriceDiffClass(priceDiff))}
              >
                {priceDiff > 0 ? "+" : ""}
                {formatCurrency(priceDiff)}/
                {billingPeriod === "yearly" ? "year" : "month"}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground text-xs">
              {t(
                "billing.planChange.prorationNote",
                "Changes will be prorated and applied to your next billing cycle."
              )}
            </p>
          </div>

          {/* Features comparison for upgrade */}
          {changeType === "upgrade" && targetTier.features && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">
                {t("billing.planChange.newFeatures", "New Features You'll Get")}
              </Label>
              <ul className="space-y-2">
                {targetTier.features
                  .slice(0, MAX_FEATURES_TO_SHOW)
                  .map((feature) => (
                    <li
                      className="flex items-center gap-2 text-sm"
                      key={feature}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                      {t(`pricing.features.${feature}`, feature)}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button disabled={isLoading} onClick={handleCancel} variant="outline">
            {t("common.cancel", "Cancel")}
          </Button>
          {(() => {
            const config = getChangeTypeConfig(changeType, t);
            return (
              <Button
                className={cn(config.buttonClass)}
                disabled={isLoading || !productId}
                onClick={handleConfirm}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common.processing", "Processing...")}
                  </>
                ) : (
                  config.confirmText
                )}
              </Button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
