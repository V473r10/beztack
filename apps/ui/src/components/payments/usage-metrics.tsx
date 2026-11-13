// import { getUsagePercentage, isUsageNearLimit } from "@beztack/payments/client";

import { AlertCircle, ArrowUpRight, Database, TrendingUp, Users, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CustomerMeter } from "@/contexts/membership-context";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MembershipTierConfig } from "@/types/membership";

// Constants
const PERCENTAGE_MAX = 100;
const PERCENTAGE_MIN = 0;
const WARNING_THRESHOLD_DEFAULT = 80;
const UNLIMITED_LIMIT = -1;

// Helper function to determine unit for a key
function getUnitForKey(key: string): string {
  if (key === "storage") {
    return " GB";
  }
  if (key === "apiCalls") {
    return "";
  }
  return "";
}

export type UsageMetricsProps = {
  meters?: CustomerMeter[];
  tierConfig: MembershipTierConfig;
  onUpgrade?: () => void;
  className?: string;
};

type UsageItemProps = {
  label: string;
  current: number;
  limit: number;
  icon: React.ComponentType<{ className?: string }>;
  unit?: string;
  warningThreshold?: number;
};

const usageIcons = {
  users: Users,
  storage: Database,
  apiCalls: Zap,
  organizations: TrendingUp,
  teams: Users,
} as const;

function UsageItem({
  label,
  current,
  limit,
  icon: Icon,
  unit = "",
  warningThreshold = 80,
}: UsageItemProps) {
  const { t } = useTranslation();
  const percentage =
    limit === UNLIMITED_LIMIT
      ? PERCENTAGE_MIN
      : Math.min((current / limit) * PERCENTAGE_MAX, PERCENTAGE_MAX);
  const isNearLimit = limit !== UNLIMITED_LIMIT && percentage >= warningThreshold;
  const isOverLimit = limit !== UNLIMITED_LIMIT && current > limit;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{label}</span>
        </div>
        <div className="text-right">
          <div className="font-medium text-sm">
            {formatNumber(current)}
            {unit} {"/"} {limit === UNLIMITED_LIMIT ? "∞" : `${formatNumber(limit)}${unit}`}
          </div>
          {limit !== UNLIMITED_LIMIT && (
            <div className="text-muted-foreground text-xs">
              {t("billing.usage.percentUsed", { percent: percentage.toFixed(0) })}
            </div>
          )}
        </div>
      </div>

      {limit !== UNLIMITED_LIMIT && (
        <div className="space-y-2">
          <Progress
            className={cn(
              "h-2",
              isOverLimit && "bg-destructive/20",
              isNearLimit && !isOverLimit && "bg-yellow-100 dark:bg-yellow-900/20",
            )}
            value={percentage}
          />

          {(isNearLimit || isOverLimit) && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs",
                isOverLimit ? "text-destructive" : "text-yellow-600 dark:text-yellow-400",
              )}
            >
              <AlertCircle className="h-3 w-3" />
              {isOverLimit ? t("billing.usage.itemExceeded") : t("billing.usage.itemNear")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UsageMetrics({ meters = [], tierConfig, onUpgrade, className }: UsageMetricsProps) {
  const { t } = useTranslation();
  // Mock current usage data based on meters or use defaults
  const getCurrentUsage = (key: string) => {
    const meter = meters.find((m: CustomerMeter) => m.id?.includes(key));
    return meter?.value || 0;
  };

  const usageData = Object.entries(tierConfig.limits || {}).map(([key, limit]) => ({
    key,
    label: t(`pricing.limits.${key}`, {
      defaultValue: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
    }),
    current: getCurrentUsage(key),
    limit,
    icon: usageIcons[key as keyof typeof usageIcons] || Database,
    unit: getUnitForKey(key),
  }));

  const hasNearLimitUsage = usageData.some(
    (item) =>
      item.limit !== UNLIMITED_LIMIT &&
      (item.current / item.limit) * PERCENTAGE_MAX >= WARNING_THRESHOLD_DEFAULT,
  );

  const hasOverLimitUsage = usageData.some(
    (item) => item.limit !== UNLIMITED_LIMIT && item.current > item.limit,
  );

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t("billing.usage.title")}</CardTitle>
          {tierConfig.id !== "ultimate" && (hasNearLimitUsage || hasOverLimitUsage) && (
            <Badge className="text-xs" variant={hasOverLimitUsage ? "destructive" : "secondary"}>
              {hasOverLimitUsage ? t("billing.usage.badgeExceeded") : t("billing.usage.badgeNear")}
            </Badge>
          )}
        </div>
        <CardDescription>
          {t("billing.usage.description", { plan: tierConfig.name })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          {usageData.map((item) => (
            <UsageItem
              current={item.current}
              icon={item.icon}
              key={item.key}
              label={item.label}
              limit={item.limit}
              unit={item.unit}
            />
          ))}
        </div>

        {tierConfig.id !== "ultimate" && (hasNearLimitUsage || hasOverLimitUsage) && onUpgrade && (
          <div
            className={cn(
              "rounded-lg border p-4",
              hasOverLimitUsage
                ? "border-destructive/20 bg-destructive/5"
                : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-medium text-sm">
                  {hasOverLimitUsage
                    ? t("billing.usage.bannerExceeded")
                    : t("billing.usage.bannerNear")}
                </div>
                <div className="text-muted-foreground text-xs">
                  {hasOverLimitUsage
                    ? t("billing.usage.hintExceeded")
                    : t("billing.usage.hintNear")}
                </div>
              </div>
              <Button
                className="shrink-0"
                onClick={onUpgrade}
                size="sm"
                variant={hasOverLimitUsage ? "default" : "outline"}
              >
                {t("billing.usage.upgradePlan")}
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {tierConfig.id === "ultimate" && (
          <div className="rounded-lg border border-muted bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Database className="h-4 w-4" />
              <span>{t("billing.usage.enterpriseUnlimited")}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
